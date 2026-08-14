import { defineConfig, devices } from "@playwright/test";

const isCi = Boolean(process.env.CI);
const baseURL = "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./src/test/e2e",
  use: {
    baseURL,
    trace: "on-first-retry",
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
    url: baseURL,
    reuseExistingServer: !isCi,
  },
});
