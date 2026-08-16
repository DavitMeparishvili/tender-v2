import "dotenv/config";
import { getTestDatabaseServerEnv } from "../src/config/test-database-url";

const CLIENT_EMAIL = "phase1.client@tender.test";
const PROVIDER_EMAIL = "phase1.provider@tender.test";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function main(): Promise<void> {
  const serverEnv = getTestDatabaseServerEnv(process.env);
  if (serverEnv.NODE_ENV === "production") {
    throw new Error("Phase 2 test seeding is unavailable in production");
  }
  process.env.DATABASE_URL = serverEnv.DATABASE_URL_TEST;

  const [
    { database },
    { createTenderDraft },
    { updateTenderDraft },
    { syncTenderLocation },
    { publishTender },
    { cancelTender },
  ] = await Promise.all([
    import("../src/infrastructure/db/client"),
    import("../src/modules/tenders/application/create-tender-draft"),
    import("../src/modules/tenders/application/update-tender-draft"),
    import("../src/modules/tenders/application/sync-tender-location"),
    import("../src/modules/tenders/application/publish-tender"),
    import("../src/modules/tenders/application/cancel-tender"),
  ]);

  async function requireSeedUser(email: string): Promise<{ id: string }> {
    try {
      return await database.user.findUniqueOrThrow({
        where: { email },
        select: { id: true },
      });
    } catch {
      throw new Error(
        `Phase 1 seeded account (${email}) not found. Run \`pnpm seed:phase-1\` first.`,
      );
    }
  }

  try {
    // The Phase 1 accounts are not (re-)created here: `seed-phase-01.ts`
    // deletes and recreates them, and `Tender.ownerId` cascades on user
    // delete, so re-running that script would silently wipe the tenders
    // seeded below. Instead, require the Phase 1 seed to have already run.
    const client = await requireSeedUser(CLIENT_EMAIL);
    // Looked up (but not used directly) so the operator is told to run the
    // Phase 1 seed if the provider account it's supposed to create is
    // missing, since Phase 2 e2e signs in as this account too.
    await requireSeedUser(PROVIDER_EMAIL);

    const actor = { id: client.id };

    // Delete any tenders already owned by the seeded client so the script
    // is re-runnable without accumulating duplicates.
    await database.tender.deleteMany({ where: { ownerId: client.id } });

    // 1. A fully published tender in Tbilisi with a comfortably future
    //    deadline, for the discovery / masked-detail journeys.
    const publishedDraft = await createTenderDraft(
      {
        specialty: "CONSTRUCTION_REPAIR",
        serviceCode: "GENERAL_CONSTRUCTION",
        title: "Renovate two-bedroom apartment interior",
      },
      actor,
    );
    if (!publishedDraft.ok) {
      throw new Error("Failed to create the published-tender draft");
    }
    const publishedUpdate = await updateTenderDraft(
      publishedDraft.value.id,
      {
        shortDescription: "Full interior renovation of a two-bedroom flat",
        fullDescription:
          "Strip out old finishes, repair walls, repaint throughout, and " +
          "replace flooring in a two-bedroom apartment.",
        scopeOfWork:
          "Demolition of old finishes, wall repair, painting, and flooring " +
          "replacement across two bedrooms, a living room, and a hallway.",
        budgetMinorUnits: 450_000,
        currency: "GEL",
        deadline: new Date(Date.now() + THIRTY_DAYS_MS),
        // Deliberately set so Task 13's e2e masking assertions have a real,
        // non-empty value to prove is absent from every provider-facing
        // surface (the masked projection has no `conditions` field at all,
        // so without this the assertion would be vacuously true).
        conditions:
          "Work must be completed on weekdays between 9am and 5pm only.",
      },
      actor,
    );
    if (!publishedUpdate.ok) {
      throw new Error(
        `Failed to complete the published-tender draft: ${publishedUpdate.error}`,
      );
    }
    const publishedLocation = await syncTenderLocation(
      publishedDraft.value.id,
      {
        mode: "ADDRESS",
        city: "Tbilisi",
        district: null,
        addressLine: "12 Rustaveli Avenue",
      },
      actor,
    );
    if (!publishedLocation.ok) {
      throw new Error(
        `Failed to set the published-tender location: ${publishedLocation.error}`,
      );
    }
    const published = await publishTender(publishedDraft.value.id, actor);
    if (!published.ok) {
      throw new Error(
        `Failed to publish the seeded tender: ${published.error}`,
      );
    }

    // 2. An incomplete DRAFT tender, for the authoring-resume journey.
    const draft = await createTenderDraft(
      {
        specialty: "CONSTRUCTION_REPAIR",
        serviceCode: "GENERAL_CONSTRUCTION",
        title: "Kitchen remodel needs a contractor",
      },
      actor,
    );
    if (!draft.ok) {
      throw new Error("Failed to create the incomplete draft tender");
    }

    // 3. A cancelled tender, cancelled directly from DRAFT.
    const cancellable = await createTenderDraft(
      {
        specialty: "CONSTRUCTION_REPAIR",
        serviceCode: "GENERAL_CONSTRUCTION",
        title: "Roof repair after storm damage",
      },
      actor,
    );
    if (!cancellable.ok) {
      throw new Error("Failed to create the to-be-cancelled draft tender");
    }
    const cancelled = await cancelTender(
      cancellable.value.id,
      { reason: "Client no longer needs this work performed" },
      actor,
    );
    if (!cancelled.ok) {
      throw new Error(`Failed to cancel the seeded tender: ${cancelled.error}`);
    }

    console.log("Seeded 3 Phase 2 test tenders.");
  } finally {
    await database.$disconnect();
  }
}

await main();
