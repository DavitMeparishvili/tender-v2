import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
import { getTestDatabaseServerEnv } from "./src/config/test-database-url";

const isCi = Boolean(process.env.CI);
const serverEnv = getTestDatabaseServerEnv(process.env);
const baseURL = serverEnv.APP_URL;
const grepIndex = process.argv.findIndex(
  (argument) => argument === "--grep" || argument.startsWith("--grep="),
);
const grepValue =
  grepIndex < 0
    ? ""
    : process.argv[grepIndex]?.startsWith("--grep=")
      ? process.argv[grepIndex]?.slice("--grep=".length)
      : process.argv[grepIndex + 1];
const usesTestMailbox = grepValue?.includes("@phase-1") ?? false;
const startsProductionServer = isCi && !usesTestMailbox;

export default defineConfig({
  testDir: "./src/test/e2e",
  forbidOnly: isCi,
  workers: 1,
  reporter: isCi ? [["dot"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: startsProductionServer ? "pnpm start" : "pnpm dev",
    env: {
      APP_URL: serverEnv.APP_URL,
      AUTH_SECRET: serverEnv.AUTH_SECRET,
      DATABASE_URL: serverEnv.DATABASE_URL,
      DATABASE_URL_TEST: serverEnv.DATABASE_URL_TEST,
      NODE_ENV: startsProductionServer ? "production" : serverEnv.NODE_ENV,
      SELECTION_WORKER_SECRET: serverEnv.SELECTION_WORKER_SECRET,
      AGREEMENT_WORKER_SECRET: serverEnv.AGREEMENT_WORKER_SECRET,
    },
    url: `${baseURL}/api/health/live`,
    reuseExistingServer: false,
  },
});
