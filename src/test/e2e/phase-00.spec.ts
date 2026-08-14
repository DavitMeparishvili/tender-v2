import { expect, test } from "@playwright/test";

const skipLinkNames = {
  ka: "მთავარ შინაარსზე გადასვლა",
  en: "Skip to main content",
} as const;

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

  test(`${locale} skip link moves keyboard focus to main content`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);

    await page.keyboard.press("Tab");

    const skipLink = page.getByRole("link", { name: skipLinkNames[locale] });
    await expect(skipLink).toBeVisible();
    await expect(skipLink).toBeFocused();

    await page.keyboard.press("Enter");

    const main = page.locator("main#main-content");
    await expect(main).toHaveCount(1);
    await expect(main).toBeFocused();
  });
}

test("root redirects to the default locale", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/ka$/);
});

test("unsupported locale returns a bounded not-found document", async ({
  page,
}) => {
  const response = await page.goto("/ru");

  expect(response?.status()).toBe(404);
  await expect(page.locator("html")).not.toHaveAttribute("lang", "ru");
  await expect(page.locator("main#main-content")).toHaveCount(1);
});
