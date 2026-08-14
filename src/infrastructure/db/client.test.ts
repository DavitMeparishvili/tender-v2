import { afterEach, beforeEach, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  nodeEnv: "development" as "development" | "production",
}));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class PrismaPg {},
}));

vi.mock("../../config/env", () => ({
  getServerEnv: () => ({
    NODE_ENV: testState.nodeEnv,
    DATABASE_URL: "postgresql://user:password@localhost:5432/tender_dev",
    AUTH_SECRET: "01234567890123456789012345678901",
    APP_URL: "http://localhost:3000",
  }),
}));

vi.mock("../../generated/prisma/client", () => ({
  PrismaClient: class PrismaClient {},
}));

const databaseGlobal = globalThis as typeof globalThis & {
  database?: unknown;
};

beforeEach(() => {
  testState.nodeEnv = "development";
  delete databaseGlobal.database;
  vi.resetModules();
});

afterEach(() => {
  delete databaseGlobal.database;
  vi.resetModules();
});

it("reuses the database client when the module reloads in development", async () => {
  const firstModule = await import("./client");

  vi.resetModules();

  const reloadedModule = await import("./client");

  expect(reloadedModule.database).toBe(firstModule.database);
});

it("ignores a pre-existing global database client in production", async () => {
  testState.nodeEnv = "production";
  const preExistingDatabase = { source: "development-cache" };
  databaseGlobal.database = preExistingDatabase;

  const productionModule = await import("./client");

  expect(productionModule.database).not.toBe(preExistingDatabase);
  expect(databaseGlobal.database).toBe(preExistingDatabase);
});
