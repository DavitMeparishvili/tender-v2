import { PrismaPg } from "@prisma/adapter-pg";
import { getServerEnv } from "../../config/env";
import { PrismaClient } from "../../generated/prisma/client";

// Bound failed health-probe connections and queries instead of relying on pg's
// unbounded defaults. Statement and client query deadlines intentionally match.
const DATABASE_CONNECTION_TIMEOUT_MS = 2_000;
const DATABASE_QUERY_TIMEOUT_MS = 3_000;

const { DATABASE_URL, NODE_ENV } = getServerEnv();
const databaseGlobal = globalThis as typeof globalThis & {
  database?: PrismaClient;
};
const cachedDatabase =
  NODE_ENV === "production" ? undefined : databaseGlobal.database;

export const database =
  cachedDatabase ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: DATABASE_URL,
      connectionTimeoutMillis: DATABASE_CONNECTION_TIMEOUT_MS,
      query_timeout: DATABASE_QUERY_TIMEOUT_MS,
      statement_timeout: DATABASE_QUERY_TIMEOUT_MS,
    }),
  });

if (NODE_ENV !== "production") {
  databaseGlobal.database = database;
}
