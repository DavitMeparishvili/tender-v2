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
    "460px",
  );
});

test("@phase-1-ui Georgian provider registration fits mobile", async ({
  page,
}) => {
  await page.goto("/ka/register/provider");

  await expect(
    page.getByRole("heading", { name: "მომსახურებას ვთავაზობ" }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveCSS(
    "font-family",
    /Manrope.*Noto Sans Georgian/,
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
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
  await page.getByLabel("Email address").fill("client@example.com");
  await page.getByLabel("Password").fill("strong-password");

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
