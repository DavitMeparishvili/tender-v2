import { test } from "@playwright/test";
import { runAccountJourney } from "./fixtures/accounts";

for (const locale of ["ka", "en"] as const) {
  test(`@phase-1 client completes the ${locale} account journey`, async ({
    page,
    request,
  }, testInfo) => {
    await runAccountJourney(
      page,
      request,
      testInfo.project.name,
      locale,
      "client",
    );
  });
}
