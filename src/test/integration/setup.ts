import "dotenv/config";
import { afterAll } from "vitest";
import { validateTestDatabaseUrl } from "../../config/test-database-url";
import { validateTestStorageBucket } from "../../config/test-storage-bucket";

process.env.DATABASE_URL = validateTestDatabaseUrl(
  process.env.DATABASE_URL_TEST,
);
// Read before the assignment: the guard compares the test bucket against the
// development bucket this run would otherwise have written to.
process.env.STORAGE_BUCKET = validateTestStorageBucket(
  process.env.STORAGE_BUCKET_TEST,
  process.env.STORAGE_BUCKET,
);

afterAll(async () => {
  const { database } = await import("../../infrastructure/db/client");
  await database.$disconnect();
});
