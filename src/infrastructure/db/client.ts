import { PrismaPg } from "@prisma/adapter-pg";
import { getServerEnv } from "../../config/env";
import { PrismaClient } from "../../generated/prisma/client";

const { DATABASE_URL } = getServerEnv();
const adapter = new PrismaPg({ connectionString: DATABASE_URL });

export const database = new PrismaClient({ adapter });
