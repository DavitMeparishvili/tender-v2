import "dotenv/config";
import { getServerEnv } from "../src/config/env";

const demoAccounts = [
  {
    key: "client",
    email: "demo.client@tender.test",
    name: "Demo Client",
    intent: "CLIENT",
    accountKind: "PERSON",
    phone: "+995555090001",
    activityDescription: "Demo residential renovation customer",
  },
  {
    key: "provider",
    email: "demo.provider@tender.test",
    name: "Demo Contractor",
    intent: "CONSTRUCTION_PROVIDER",
    accountKind: "COMPANY",
    phone: "+995555090002",
    activityDescription: "Demo construction and renovation contractor",
  },
  {
    key: "admin",
    email: "demo.admin@tender.test",
    name: "Demo Administrator",
    intent: "CLIENT",
    accountKind: "PERSON",
    phone: "+995555090003",
    activityDescription: "Demo moderation account",
  },
] as const;

function demoPassword(): string {
  const password = process.env.DEMO_SEED_PASSWORD;
  if (password === undefined || password.length < 12) {
    throw new Error(
      "DEMO_SEED_PASSWORD must contain at least 12 random characters",
    );
  }
  return password;
}

function assertDemoDatabase(databaseUrl: string): void {
  const parsed = new URL(databaseUrl);
  const databaseName = decodeURIComponent(parsed.pathname.slice(1));
  if (
    databaseName !== "tender_demo" ||
    process.env.DEMO_SEED_CONFIRM !== databaseName
  ) {
    throw new Error(
      "Demo seeding requires the tender_demo database and DEMO_SEED_CONFIRM=tender_demo",
    );
  }
}

async function main(): Promise<void> {
  const env = getServerEnv();
  if (env.NODE_ENV !== "production") {
    throw new Error(
      "The demo seeder is only available with NODE_ENV=production",
    );
  }
  assertDemoDatabase(env.DATABASE_URL);
  const password = demoPassword();

  const [
    { auth },
    { database },
    { completeOnboarding },
    { createTenderDraft },
    { updateTenderDraft },
    { syncTenderLocation },
    { publishTender },
  ] = await Promise.all([
    import("../src/modules/identity/infrastructure/auth"),
    import("../src/infrastructure/db/client"),
    import("../src/modules/profiles/application/complete-onboarding"),
    import("../src/modules/tenders/application/create-tender-draft"),
    import("../src/modules/tenders/application/update-tender-draft"),
    import("../src/modules/tenders/application/sync-tender-location"),
    import("../src/modules/tenders/application/publish-tender"),
  ]);

  const emails = demoAccounts.map(({ email }) => email);
  try {
    const existing = await database.user.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    });
    if (existing.length === demoAccounts.length) {
      console.log("Demo accounts are already seeded; no changes were made.");
      return;
    }
    if (existing.length !== 0) {
      throw new Error(
        "Only some demo accounts exist. Remove or repair them before rerunning the demo seed.",
      );
    }

    const userIds = new Map<string, string>();
    for (const spec of demoAccounts) {
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
      userIds.set(spec.key, user.id);

      const onboarded = await completeOnboarding(
        {
          intent: spec.intent,
          accountKind: spec.accountKind,
          displayName: spec.name,
          phoneE164: spec.phone,
          countryCode: "GE",
          city: "Tbilisi",
          activityDescription: spec.activityDescription,
          preferredLocale: "en",
          preferredCurrency: "GEL",
        },
        { id: user.id, emailVerified: true },
      );
      if (!onboarded.ok) {
        throw new Error(`Could not onboard ${spec.key}: ${onboarded.error}`);
      }
    }

    const adminId = userIds.get("admin");
    const clientId = userIds.get("client");
    if (adminId === undefined || clientId === undefined) {
      throw new Error(
        "Demo account creation did not return the expected users",
      );
    }
    await database.userCapability.create({
      data: {
        id: crypto.randomUUID(),
        userId: adminId,
        code: "ADMIN",
        grantedBy: "demo-seed",
      },
    });

    const actor = { id: clientId };
    const draft = await createTenderDraft(
      {
        specialty: "CONSTRUCTION_REPAIR",
        serviceCode: "RENOVATION_REMODELING",
        title: "Demo apartment renovation in Tbilisi",
      },
      actor,
    );
    if (!draft.ok)
      throw new Error(`Could not create demo tender: ${draft.error}`);
    const updated = await updateTenderDraft(
      draft.value.id,
      {
        shortDescription: "Renovation of a two-bedroom apartment",
        fullDescription:
          "Remove old finishes, repair walls, repaint rooms, and replace flooring in a two-bedroom apartment.",
        scopeOfWork:
          "Demolition of old finishes, surface preparation, painting, and laminate flooring installation.",
        budgetMinorUnits: 450_000,
        currency: "GEL",
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
        conditions:
          "Work should be performed on weekdays between 09:00 and 18:00.",
      },
      actor,
    );
    if (!updated.ok) {
      throw new Error(`Could not complete demo tender: ${updated.error}`);
    }
    const located = await syncTenderLocation(
      draft.value.id,
      {
        mode: "ADDRESS",
        city: "Tbilisi",
        district: "Saburtalo",
        addressLine: "Demo address, 12 Pekini Avenue",
      },
      actor,
    );
    if (!located.ok) {
      throw new Error(`Could not locate demo tender: ${located.error}`);
    }
    const published = await publishTender(draft.value.id, actor);
    if (!published.ok) {
      throw new Error(`Could not publish demo tender: ${published.error}`);
    }

    console.log(
      `Seeded demo accounts (${emails.join(", ")}) and one published tender.`,
    );
  } finally {
    await database.$disconnect();
  }
}

await main();
