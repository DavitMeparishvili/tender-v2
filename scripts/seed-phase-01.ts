import "dotenv/config";
import { getTestDatabaseServerEnv } from "../src/config/test-database-url";

const accountSpecs = [
  {
    key: "client",
    email: "phase1.client@tender.test",
    name: "Seeded Client",
    verified: true,
    intent: "CLIENT",
    phone: "+995555010001",
  },
  {
    key: "provider",
    email: "phase1.provider@tender.test",
    name: "Seeded Provider",
    verified: true,
    intent: "CONSTRUCTION_PROVIDER",
    phone: "+995555010002",
  },
  {
    key: "dual",
    email: "phase1.dual@tender.test",
    name: "Seeded Dual Company",
    verified: true,
    intent: "CONSTRUCTION_PROVIDER",
    phone: "+995555010003",
  },
  {
    key: "incomplete",
    email: "phase1.incomplete@tender.test",
    name: "Seeded Incomplete",
    verified: true,
    intent: null,
    phone: null,
  },
  {
    key: "unverified",
    email: "phase1.unverified@tender.test",
    name: "Seeded Unverified",
    verified: false,
    intent: null,
    phone: null,
  },
  {
    key: "restricted",
    email: "phase1.restricted@tender.test",
    name: "Seeded Restricted Client",
    verified: true,
    intent: "CLIENT",
    phone: "+995555010004",
  },
  {
    key: "disabled",
    email: "phase1.disabled@tender.test",
    name: "Seeded Disabled Client",
    verified: true,
    intent: "CLIENT",
    phone: "+995555010005",
  },
] as const;
const PHASE_4_TENDER_TITLE = "Phase 3 tender whose deadline has passed";

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
    throw new Error("Phase 1 test seeding is unavailable in production");
  }
  process.env.DATABASE_URL = serverEnv.DATABASE_URL_TEST;

  const [{ auth }, { database }, { completeOnboarding }] = await Promise.all([
    import("../src/modules/identity/infrastructure/auth"),
    import("../src/infrastructure/db/client"),
    import("../src/modules/profiles/application/complete-onboarding"),
  ]);
  const password = requiredPassword();

  try {
    // Agreement snapshots deliberately retain their participants, so a prior
    // Phase 4 browser run prevents the Phase 1 fixture accounts from being
    // recreated. These are only the Phase 3/4 deterministic fixtures (never
    // arbitrary agreements); reviews must be removed first because their FK
    // preserves the original agreement record in normal operation.
    await database.review.deleteMany({
      where: { agreement: { tenderTitle: PHASE_4_TENDER_TITLE } },
    });
    await database.agreement.deleteMany({
      where: { tenderTitle: PHASE_4_TENDER_TITLE },
    });
    await database.user.deleteMany({
      where: { email: { in: accountSpecs.map(({ email }) => email) } },
    });

    for (const spec of accountSpecs) {
      await auth.api.signUpEmail({
        body: { email: spec.email, name: spec.name, password },
      });
      const user = spec.verified
        ? await database.user.update({
            where: { email: spec.email },
            data: { emailVerified: true },
            select: { id: true },
          })
        : await database.user.findUniqueOrThrow({
            where: { email: spec.email },
            select: { id: true },
          });

      if (spec.intent !== null && spec.phone !== null) {
        const onboarded = await completeOnboarding(
          {
            intent: spec.intent,
            accountKind:
              spec.intent === "CONSTRUCTION_PROVIDER" ? "COMPANY" : "PERSON",
            displayName: spec.name,
            phoneE164: spec.phone,
            countryCode: "GE",
            city: "Tbilisi",
            activityDescription:
              spec.intent === "CONSTRUCTION_PROVIDER"
                ? "Seeded construction and repair services"
                : "Seeded residential renovation projects",
            preferredLocale: "en",
            preferredCurrency: "GEL",
          },
          { id: user.id, emailVerified: true },
        );
        if (!onboarded.ok) {
          throw new Error(`Could not onboard ${spec.key}: ${onboarded.error}`);
        }
      }

      if (spec.key === "dual") {
        await database.userCapability.create({
          data: {
            id: crypto.randomUUID(),
            userId: user.id,
            code: "CUSTOMER",
            grantedBy: "phase-1-seed",
          },
        });
      }
      if (spec.key === "restricted") {
        await database.userProfile.update({
          where: { userId: user.id },
          data: { restrictedUntil: new Date("2099-01-01T00:00:00.000Z") },
        });
      }
      if (spec.key === "disabled") {
        await database.userProfile.update({
          where: { userId: user.id },
          data: { disabledAt: new Date() },
        });
      }
    }

    console.log(`Seeded ${accountSpecs.length} Phase 1 test accounts.`);
  } finally {
    await database.$disconnect();
  }
}

await main();
