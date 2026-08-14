import { PrismaPg } from "@prisma/adapter-pg";
import { getServerEnv } from "../../config/env";
import { PrismaClient } from "../../generated/prisma/client";

const { DATABASE_URL, NODE_ENV } = getServerEnv();
const databaseGlobal = globalThis as typeof globalThis & {
  database?: PrismaClient;
};

export const database =
  databaseGlobal.database ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: DATABASE_URL }),
  });

if (NODE_ENV !== "production") {
  databaseGlobal.database = database;
}
