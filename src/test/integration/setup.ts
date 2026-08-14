import "dotenv/config";
import { afterAll } from "vitest";
import { validateTestDatabaseUrl } from "../../config/test-database-url";

process.env.DATABASE_URL = validateTestDatabaseUrl(
  process.env.DATABASE_URL_TEST,
);

afterAll(async () => {
  const { database } = await import("../../infrastructure/db/client");
  await database.$disconnect();
});
