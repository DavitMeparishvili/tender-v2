import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { getServerEnv } from "../src/config/env";

const LOCAL_CLIENT_EMAIL = "phase1.client@tender.test";

function requiredPassword(): string {
  const password = process.env.LOCAL_CLIENT_PASSWORD;
  if (password === undefined || password.length < 12) {
    throw new Error(
      "LOCAL_CLIENT_PASSWORD must contain at least 12 characters",
    );
  }
  return password;
}

function assertDevelopmentDatabase(): void {
  const env = getServerEnv();
  const databaseName = decodeURIComponent(
    new URL(env.DATABASE_URL).pathname.slice(1),
  );
  const testDatabaseExplicitlyAllowed =
    process.env.LOCAL_CLIENT_ALLOW_TEST_DATABASE === "true";
  const allowedDatabase =
    databaseName.endsWith("_dev") ||
    (testDatabaseExplicitlyAllowed && databaseName.endsWith("_test"));

  if (env.NODE_ENV !== "development" || !allowedDatabase) {
    throw new Error(
      "The local client seeder only runs in development against a _dev database, or an explicitly allowed _test database",
    );
  }
}

async function main(): Promise<void> {
  assertDevelopmentDatabase();
  const password = requiredPassword();
  const [{ auth }, { database }, { completeOnboarding }] = await Promise.all([
    import("../src/modules/identity/infrastructure/auth"),
    import("../src/infrastructure/db/client"),
    import("../src/modules/profiles/application/complete-onboarding"),
  ]);

  try {
    let user = await database.user.findUnique({
      where: { email: LOCAL_CLIENT_EMAIL },
      select: { id: true, profile: { select: { id: true } } },
    });

    if (user === null) {
      await auth.api.signUpEmail({
        body: {
          email: LOCAL_CLIENT_EMAIL,
          name: "Local Client",
          idNumber: "01010101010",
          cityOrTown: "Tbilisi",
          address: "12 Rustaveli Avenue, Tbilisi",
          password,
        },
      });
      user = await database.user.findUniqueOrThrow({
        where: { email: LOCAL_CLIENT_EMAIL },
        select: { id: true, profile: { select: { id: true } } },
      });
    } else {
      const credentialAccount = await database.account.findFirst({
        where: { userId: user.id, providerId: "credential" },
        select: { id: true },
      });
      if (credentialAccount === null) {
        throw new Error(
          `${LOCAL_CLIENT_EMAIL} exists without a credential account`,
        );
      }
      await database.account.update({
        where: { id: credentialAccount.id },
        data: { password: await hashPassword(password) },
      });
    }

    await database.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    if (user.profile === null) {
      const onboarded = await completeOnboarding(
        {
          intent: "CLIENT",
          accountKind: "PERSON",
          displayName: "Local Client",
          phoneE164: "+995555019901",
          countryCode: "GE",
          city: "Tbilisi",
          activityDescription: "Local development tender client",
          preferredLocale: "en",
          preferredCurrency: "GEL",
        },
        { id: user.id, emailVerified: true },
      );
      if (!onboarded.ok) {
        throw new Error(`Could not onboard local client: ${onboarded.error}`);
      }
    }

    console.log(`Local client is ready: ${LOCAL_CLIENT_EMAIL}`);
  } finally {
    await database.$disconnect();
  }
}

await main();
