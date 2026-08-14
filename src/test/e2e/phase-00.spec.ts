import { expect, test } from "@playwright/test";

for (const locale of ["ka", "en"] as const) {
  test(`${locale} shell and health are reachable`, async ({
    page,
    request,
  }) => {
    await page.goto(`/${locale}`);
    await expect(page.getByRole("main")).toBeVisible();
    const live = await request.get("/api/health/live");
    expect(await live.json()).toEqual({ status: "ok" });
    const ready = await request.get("/api/health/ready");
    expect(ready.status()).toBe(200);
  });
}
