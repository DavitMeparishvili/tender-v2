import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Runtime traffic may use a pooler, while migrations require a direct
  // PostgreSQL session. Local development continues to need only DATABASE_URL.
  datasource: {
    url: process.env.DIRECT_DATABASE_URL ?? env("DATABASE_URL"),
  },
});
