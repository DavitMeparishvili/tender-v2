import { expect, test } from "@playwright/test";

test("@phase-1-ui registration is keyboard-complete and focus-safe", async ({
  page,
}) => {
  await page.goto("/en/register/client");

  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();

  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator("#form-errors")).toBeFocused();
  await expect(page.locator("[data-identity-frame]")).toHaveCSS(
    "max-width",
    "720px",
  );
});

test("@phase-1-ui Georgian provider registration fits mobile", async ({
  page,
}) => {
  await page.goto("/ka/register/provider");

  await expect(
    page.getByRole("heading", { name: "მომსახურებას ვთავაზობ" }),
  ).toBeVisible();
  await expect(page.getByLabel("საიდენტიფიკაციო ნომერი")).toHaveAttribute(
    "required",
    "",
  );
  await expect(page.getByLabel("ქალაქი ან დაბა")).toHaveAttribute(
    "required",
    "",
  );
  await expect(page.getByLabel("ქუჩის მისამართი")).toHaveAttribute(
    "required",
    "",
  );
  await expect(page.locator("body")).toHaveCSS(
    "font-family",
    /Manrope.*Noto Sans Georgian/,
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("@phase-1-ui client and provider registrations require identity details", async ({
  page,
}) => {
  for (const role of ["client", "provider"] as const) {
    await page.goto(`/en/register/${role}`);

    await expect(page.getByLabel("ID number")).toHaveAttribute("required", "");
    await expect(page.getByLabel("City or town")).toHaveAttribute(
      "required",
      "",
    );
    await expect(page.getByLabel("Street address")).toHaveAttribute(
      "required",
      "",
    );
    await expect(page.getByLabel("Confirm password")).toHaveAttribute(
      "required",
      "",
    );
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.locator("#form-errors")).toContainText(
      "Enter a 9-digit company ID or 11-digit personal ID.",
    );
    await expect(page.locator("#form-errors")).toContainText(
      "Enter a city or town between 2 and 120 characters.",
    );
    await expect(page.locator("#form-errors")).toContainText(
      "Enter a full address between 5 and 240 characters.",
    );
  }
});

test("@phase-1-ui pending submission preserves its action label", async ({
  page,
}) => {
  let releaseRequest: () => void = () => undefined;
  const requestGate = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await page.route("**/api/auth/sign-up/email", async (route) => {
    await requestGate;
    await route.fulfill({ status: 200, json: { user: null } });
  });
  await page.goto("/en/register/client");
  await page.getByLabel("Name").fill("Tender Client");
  await page.getByLabel("ID number").fill("01010101010");
  await page.getByLabel("City or town").fill("Tbilisi");
  await page.getByLabel("Street address").fill("12 Rustaveli Avenue");
  await page.getByLabel("Email address").fill("client@example.com");
  await page.getByLabel("Password", { exact: true }).fill("strong-password");
  await page.getByLabel("Confirm password").fill("strong-password");

  const submit = page.getByRole("button", { name: /Create account/ });
  await submit.click();
  await expect(submit).toContainText("Create account");
  await expect(submit).toContainText("Creating account");
  await expect(submit).toBeDisabled();
  releaseRequest();
});

test("@phase-1-ui locale control preserves route and protects dirty input", async ({
  page,
}) => {
  await page.goto("/en/register/client");
  await page.getByLabel("Name").fill("Unsaved Client");
  const localeLink = page.getByRole("link", { name: "ქართული" });
  await expect(localeLink).toHaveAttribute("href", "/ka/register/client");

  page.once("dialog", (dialog) => dialog.dismiss());
  await localeLink.click();
  await expect(page).toHaveURL(/\/en\/register\/client$/);
  await expect(page.getByLabel("Name")).toHaveValue("Unsaved Client");

  page.once("dialog", (dialog) => dialog.accept());
  await localeLink.click();
  await expect(page).toHaveURL(/\/ka\/register\/client$/);
});

test("@phase-1-ui language switcher is touch-ready in the mobile header", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"));

  await page.goto("/en/register/client");
  const switcher = page.locator(".mobile-locale .locale-link");

  await expect(switcher).toBeVisible();
  await expect(switcher).toHaveText("KA");
  await expect(switcher).toHaveAttribute("href", "/ka/register/client");
  await expect(switcher).toHaveAttribute("aria-label", "ქართული");

  const box = await switcher.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);

  await page.setViewportSize({ width: 375, height: 800 });
  const headerWidths = await page
    .locator(".site-header .band-inner")
    .evaluate((element) => ({
      client: element.clientWidth,
      scroll: element.scrollWidth,
    }));
  expect(headerWidths.scroll).toBeLessThanOrEqual(headerWidths.client);
  await expect(page.locator(".header-actions")).toBeHidden();

  await switcher.click();
  await expect(page).toHaveURL(/\/ka\/register\/client$/);
  await expect(page.locator(".mobile-locale .locale-link")).toHaveText("EN");
});
