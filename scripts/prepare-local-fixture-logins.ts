import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { getServerEnv } from "../src/config/env";

const fixtureEmails = [
  "phase1.client@tender.test",
  "phase3.provider.b@tender.test",
  "phase1.provider@tender.test",
  "phase4.admin@tender.test",
] as const;

function requiredPassword(): string {
  const password = process.env.LOCAL_FIXTURE_PASSWORD;
  if (password === undefined || password.length < 12) {
    throw new Error(
      "LOCAL_FIXTURE_PASSWORD must contain at least 12 characters",
    );
  }
  return password;
}

function assertLocalTestDatabase(): void {
  const env = getServerEnv();
  const databaseName = decodeURIComponent(
    new URL(env.DATABASE_URL).pathname.slice(1),
  );
  if (env.NODE_ENV !== "development" || !databaseName.endsWith("_test")) {
    throw new Error(
      "Fixture login preparation only runs in development against a database ending in _test",
    );
  }
}

async function main(): Promise<void> {
  assertLocalTestDatabase();
  const password = requiredPassword();
  const { database } = await import("../src/infrastructure/db/client");

  try {
    const users = await database.user.findMany({
      where: { email: { in: [...fixtureEmails] } },
      select: {
        email: true,
        accounts: {
          where: { providerId: "credential" },
          select: { id: true },
        },
      },
    });
    const accountsByEmail = new Map(
      users.map((user) => [user.email, user.accounts[0]?.id]),
    );
    const missing = fixtureEmails.filter(
      (email) => accountsByEmail.get(email) === undefined,
    );
    if (missing.length > 0) {
      throw new Error(
        `Missing fixture credential accounts: ${missing.join(", ")}`,
      );
    }

    const credentials = await Promise.all(
      fixtureEmails.map(async (email) => ({
        email,
        passwordHash: await hashPassword(password),
      })),
    );
    await database.$transaction(
      credentials.map(({ email, passwordHash }) =>
        database.account.update({
          where: { id: accountsByEmail.get(email)! },
          data: { password: passwordHash },
        }),
      ),
    );

    console.log(`Prepared ${fixtureEmails.length} local fixture logins.`);
  } finally {
    await database.$disconnect();
  }
}

await main();
