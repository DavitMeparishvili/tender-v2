import "dotenv/config";
import { getTestDatabaseServerEnv } from "../src/config/test-database-url";

const CLIENT_EMAIL = "phase1.client@tender.test";
const PROVIDER_A_EMAIL = "phase1.provider@tender.test";

// Phase 1 seeds one provider; the deadline journey needs three competing
// bidders, so this script creates the two extra accounts itself, through the
// same public interfaces (Better Auth sign-up plus the onboarding use case)
// that a real registration uses.
const EXTRA_PROVIDERS = [
  {
    key: "providerB",
    email: "phase3.provider.b@tender.test",
    name: "Seeded Provider B",
    phone: "+995555030002",
  },
  {
    key: "providerC",
    email: "phase3.provider.c@tender.test",
    name: "Seeded Provider C",
    phone: "+995555030003",
  },
] as const;

// Every tender this phase owns is titled "Phase 3 ...", including the ones the
// browser journeys publish for themselves. Deleting by that prefix (not by
// owner) keeps the Phase 2 seed's tenders intact, so `verify:phase-3` can seed
// both phases in order, and stops journey tenders accumulating across runs.
const PHASE_3_TITLE_PREFIX = "Phase 3 ";
const DUE_TENDER_TITLE = "Phase 3 tender whose deadline has passed";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const CONDITIONS =
  "Materials and labour are included; scaffolding is excluded from this price.";

function requiredPassword(): string {
  const password = process.env.PHASE_1_SEED_PASSWORD;
  if (password === undefined || password.length < 12) {
    throw new Error(
      "PHASE_1_SEED_PASSWORD must contain at least 12 random characters",
    );
  }
  return password;
}

async function main(): Promise<void> {
  const serverEnv = getTestDatabaseServerEnv(process.env);
  if (serverEnv.NODE_ENV === "production") {
    throw new Error("Phase 3 test seeding is unavailable in production");
  }
  process.env.DATABASE_URL = serverEnv.DATABASE_URL_TEST;

  const [
    { auth },
    { database },
    { completeOnboarding },
    { createTenderDraft },
    { updateTenderDraft },
    { syncTenderLocation },
    { publishTender },
    { startAccessCheckout },
    { confirmAccessCheckout },
    { submitBid },
  ] = await Promise.all([
    import("../src/modules/identity/infrastructure/auth"),
    import("../src/infrastructure/db/client"),
    import("../src/modules/profiles/application/complete-onboarding"),
    import("../src/modules/tenders/application/create-tender-draft"),
    import("../src/modules/tenders/application/update-tender-draft"),
    import("../src/modules/tenders/application/sync-tender-location"),
    import("../src/modules/tenders/application/publish-tender"),
    import("../src/modules/access/application/start-access-checkout"),
    import("../src/modules/access/application/confirm-access-checkout"),
    import("../src/modules/bidding/application/submit-bid"),
  ]);
  const password = requiredPassword();

  try {
    const client = await database.user
      .findUniqueOrThrow({
        where: { email: CLIENT_EMAIL },
        select: { id: true },
      })
      .catch(() => {
        throw new Error(
          `Phase 1 seeded account (${CLIENT_EMAIL}) not found. Run \`pnpm seed:phase-1\` first.`,
        );
      });
    const actor = { id: client.id };

    // Re-runnable: drop only this script's own tenders and provider accounts.
    await database.tender.deleteMany({
      where: { title: { startsWith: PHASE_3_TITLE_PREFIX } },
    });
    await database.user.deleteMany({
      where: { email: { in: EXTRA_PROVIDERS.map(({ email }) => email) } },
    });

    // Bidder order matters below: the Phase 1 provider bids highest, so the
    // browser gate has a loser whose account already exists in every phase.
    const providerA = await database.user.findUniqueOrThrow({
      where: { email: PROVIDER_A_EMAIL },
      select: { id: true },
    });
    const providerIds: string[] = [providerA.id];
    for (const spec of EXTRA_PROVIDERS) {
      await auth.api.signUpEmail({
        body: {
          email: spec.email,
          name: spec.name,
          idNumber: "01010101010",
          cityOrTown: "Tbilisi",
          address: "12 Rustaveli Avenue, Tbilisi",
          password,
        },
      });
      const user = await database.user.update({
        where: { email: spec.email },
        data: { emailVerified: true },
        select: { id: true },
      });
      const onboarded = await completeOnboarding(
        {
          intent: "CONSTRUCTION_PROVIDER",
          accountKind: "COMPANY",
          displayName: spec.name,
          phoneE164: spec.phone,
          countryCode: "GE",
          city: "Tbilisi",
          activityDescription: "Seeded construction and repair services",
          preferredLocale: "en",
          preferredCurrency: "GEL",
        },
        { id: user.id, emailVerified: true },
      );
      if (!onboarded.ok) {
        throw new Error(`Could not onboard ${spec.key}: ${onboarded.error}`);
      }
      providerIds.push(user.id);
    }

    async function publishTenderNamed(title: string): Promise<string> {
      const draft = await createTenderDraft(
        {
          specialty: "CONSTRUCTION_REPAIR",
          serviceCode: "GENERAL_CONSTRUCTION",
          title,
        },
        actor,
      );
      if (!draft.ok) throw new Error(`Failed to draft "${title}"`);
      const updated = await updateTenderDraft(
        draft.value.id,
        {
          shortDescription: "Repaint and refinish a two-bedroom flat",
          fullDescription:
            "Strip old finishes, repair walls, and repaint throughout a " +
            "two-bedroom apartment.",
          scopeOfWork:
            "Demolition of old finishes, wall repair, and painting across " +
            "two bedrooms and a hallway.",
          budgetMinorUnits: 450_000,
          currency: "GEL",
          deadline: new Date(Date.now() + THIRTY_DAYS_MS),
          conditions: "Work must be completed on weekdays between 9am and 5pm.",
        },
        actor,
      );
      if (!updated.ok) throw new Error(`Failed to complete "${title}"`);
      const located = await syncTenderLocation(
        draft.value.id,
        {
          mode: "ADDRESS",
          city: "Tbilisi",
          district: null,
          addressLine: "12 Rustaveli Avenue",
        },
        actor,
      );
      if (!located.ok) throw new Error(`Failed to locate "${title}"`);
      const published = await publishTender(draft.value.id, actor);
      if (!published.ok) throw new Error(`Failed to publish "${title}"`);
      return draft.value.id;
    }

    async function entitle(
      providerId: string,
      tenderId: string,
    ): Promise<void> {
      const checkout = await startAccessCheckout(
        { product: "SINGLE_TENDER", tenderId },
        { id: providerId },
      );
      if (!checkout.ok) {
        throw new Error(`Failed to start checkout: ${checkout.error}`);
      }
      const confirmed = await confirmAccessCheckout(checkout.value.checkoutId, {
        id: providerId,
      });
      if (!confirmed.ok) {
        throw new Error(`Failed to confirm checkout: ${confirmed.error}`);
      }
    }

    // One tender, with three competing offers, whose deadline has already
    // passed — so the selection journey can run the worker immediately. The
    // access journey publishes its own tender per run rather than sharing
    // this one, because buying access and bidding are not repeatable against
    // a single fixture.
    const dueTenderId = await publishTenderNamed(DUE_TENDER_TITLE);
    const amounts = [420_000, 380_000, 400_000];
    let lastQualifyingSubmittedAt: Date | null = null;
    for (const [index, providerId] of providerIds.entries()) {
      await entitle(providerId, dueTenderId);
      const bid = await submitBid(
        dueTenderId,
        { amountMinorUnits: amounts[index]!, conditions: CONDITIONS },
        { id: providerId },
      );
      if (!bid.ok) throw new Error(`Failed to seed bid ${index}: ${bid.error}`);
      lastQualifyingSubmittedAt = bid.value.qualifyingSubmittedAt;
    }

    // The one fixture-only write in this script, and the reason it is safe:
    // every bid above was submitted through the real use case while the
    // deadline was still in the future. Moving the deadline afterwards makes
    // the tender due without weakening a single application rule — the same
    // pattern seed-phase-01.ts uses for restricted/disabled fixture state.
    //
    // The new deadline is anchored to the LAST bid's own qualifying timestamp
    // (not to wall-clock "now"): a bid is only eligible if it was submitted
    // strictly before the deadline, and the three sequential submissions
    // above take far less than a second, so "now minus a fixed offset" can
    // land *before* the bids themselves and make every one of them ineligible
    // instead of due. Anchoring to the last bid's timestamp guarantees the
    // deadline lands after all three submissions while still being safely in
    // the past by the time anything (this script's own exit, or a later
    // worker sweep) checks it.
    await database.tender.update({
      where: { id: dueTenderId },
      data: {
        deadline: new Date(lastQualifyingSubmittedAt!.getTime() + 1_000),
      },
    });

    console.log(
      `Seeded 1 due Phase 3 tender, ${EXTRA_PROVIDERS.length} extra providers, and 3 offers.`,
    );
  } finally {
    await database.$disconnect();
  }
}

await main();
