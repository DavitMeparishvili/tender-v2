import "dotenv/config";
import { getTestDatabaseServerEnv } from "../src/config/test-database-url";

const CLIENT_EMAIL = "phase1.client@tender.test";
const PROVIDER_EMAIL = "phase3.provider.b@tender.test";
const ADMIN_EMAIL = "phase4.admin@tender.test";
const DUE_TENDER_TITLE = "Phase 3 tender whose deadline has passed";

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
    throw new Error("Phase 4 test seeding is unavailable in production");
  }
  process.env.DATABASE_URL = serverEnv.DATABASE_URL_TEST;

  const [
    { auth },
    { database },
    { completeOnboarding },
    { runDeadlineSelection },
  ] = await Promise.all([
    import("../src/modules/identity/infrastructure/auth"),
    import("../src/infrastructure/db/client"),
    import("../src/modules/profiles/application/complete-onboarding"),
    import("../src/modules/bidding/application/run-deadline-selection"),
  ]);

  try {
    const [client, provider, tender] = await Promise.all([
      database.user.findUnique({
        where: { email: CLIENT_EMAIL },
        select: { id: true },
      }),
      database.user.findUnique({
        where: { email: PROVIDER_EMAIL },
        select: { id: true },
      }),
      database.tender.findFirst({
        where: { title: DUE_TENDER_TITLE },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      }),
    ]);
    if (client === null || provider === null || tender === null) {
      throw new Error(
        "Phase 4 fixtures require Phase 1 and Phase 3 seeds. Run `pnpm seed:phase-1`, `pnpm seed:phase-2`, and `pnpm seed:phase-3` first.",
      );
    }

    // Previous browser runs leave completed agreements behind because agreement
    // snapshots intentionally outlive tender rows. Reset only this fixed
    // tender's Phase 4 graph, then let the real selector make a fresh pending
    // agreement. Shared accounts, unrelated tenders, access, and bids remain
    // untouched. This makes `pnpm seed:phase-4` independently re-runnable.
    const historicalAgreements = await database.agreement.findMany({
      where: { tenderTitle: DUE_TENDER_TITLE },
      select: { id: true },
    });
    const historicalAgreementIds = historicalAgreements.map(({ id }) => id);
    const historicalReviews = await database.review.findMany({
      where: { agreementId: { in: historicalAgreementIds } },
      select: { id: true },
    });
    const historicalReviewIds = historicalReviews.map(({ id }) => id);

    await database.inboxNotification.deleteMany({
      where: {
        OR: [
          {
            aggregateType: "Agreement",
            aggregateId: { in: historicalAgreementIds },
          },
          { aggregateType: "Review", aggregateId: { in: historicalReviewIds } },
          { recipient: { email: ADMIN_EMAIL } },
          { aggregateType: "Tender", aggregateId: tender.id },
        ],
      },
    });
    await database.auditEvent.deleteMany({
      where: {
        OR: [
          { targetType: "Agreement", targetId: { in: historicalAgreementIds } },
          { targetType: "Review", targetId: { in: historicalReviewIds } },
          { targetType: "Tender", targetId: tender.id },
        ],
      },
    });
    await database.review.deleteMany({
      where: { id: { in: historicalReviewIds } },
    });
    await database.agreement.deleteMany({
      where: { id: { in: historicalAgreementIds } },
    });
    await database.outboxMessage.deleteMany({
      where: { aggregateId: tender.id },
    });
    await database.tenderSelection.deleteMany({
      where: { tenderId: tender.id },
    });
    await database.bid.updateMany({
      where: { tenderId: tender.id },
      data: { status: "SUBMITTED" },
    });
    await database.tender.update({
      where: { id: tender.id },
      data: { status: "PUBLISHED", cancelledAt: null, cancelReason: null },
    });

    // The worker owns winner selection. It is invoked through the real
    // application service rather than through a fixture-only winner write.
    const selected = await runDeadlineSelection(tender.id);
    if (!selected.ok || selected.value.agreementId === null) {
      throw new Error(
        "The Phase 3 due tender did not produce a winning agreement",
      );
    }
    const agreement = await database.agreement.findUniqueOrThrow({
      where: { id: selected.value.agreementId },
      select: { id: true, status: true, clientId: true, providerId: true },
    });
    if (
      agreement.status !== "PENDING_CONFIRMATION" ||
      agreement.clientId !== client.id ||
      agreement.providerId !== provider.id
    ) {
      throw new Error(
        "Phase 4 fixture selection did not create a pending agreement.",
      );
    }

    // Better Auth creates the account; this is the explicit, fixture-owned
    // moderation setup step that grants ADMIN afterwards.
    await database.user.deleteMany({ where: { email: ADMIN_EMAIL } });
    await auth.api.signUpEmail({
      body: {
        email: ADMIN_EMAIL,
        name: "Phase 4 Moderator",
        password: requiredPassword(),
      },
    });
    const admin = await database.user.update({
      where: { email: ADMIN_EMAIL },
      data: { emailVerified: true },
      select: { id: true },
    });
    const onboarded = await completeOnboarding(
      {
        intent: "CLIENT",
        accountKind: "PERSON",
        displayName: "Phase 4 Moderator",
        phoneE164: "+995555040001",
        countryCode: "GE",
        city: "Tbilisi",
        activityDescription: "Fixture moderation account",
        preferredLocale: "en",
        preferredCurrency: "GEL",
      },
      { id: admin.id, emailVerified: true },
    );
    if (!onboarded.ok) {
      throw new Error(`Could not onboard Phase 4 admin: ${onboarded.error}`);
    }
    await database.userCapability.create({
      data: {
        id: crypto.randomUUID(),
        userId: admin.id,
        code: "ADMIN",
        grantedBy: "phase-4-seed",
      },
    });

    console.log(
      `Seeded Phase 4 fixtures: agreement ${agreement.id}; client ${client.id}; provider ${provider.id}; admin ${admin.id}.`,
    );
  } finally {
    await database.$disconnect();
  }
}

await main();
