import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
import { getTestDatabaseServerEnv } from "./src/config/test-database-url";

const isCi = Boolean(process.env.CI);
const baseURL = "http://127.0.0.1:3000";
const serverEnv = getTestDatabaseServerEnv(process.env);

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
    command: isCi ? "pnpm start" : "pnpm dev",
    env: {
      APP_URL: serverEnv.APP_URL,
      AUTH_SECRET: serverEnv.AUTH_SECRET,
      DATABASE_URL: serverEnv.DATABASE_URL,
      DATABASE_URL_TEST: serverEnv.DATABASE_URL_TEST,
      NODE_ENV: serverEnv.NODE_ENV,
    },
    url: `${baseURL}/api/health/live`,
    reuseExistingServer: false,
  },
});
