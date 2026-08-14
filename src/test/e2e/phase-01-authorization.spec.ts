import { expect, test } from "@playwright/test";
import {
  messagesFor,
  phaseOnePassword,
  signInSeededAccount,
} from "./fixtures/accounts";

const messages = messagesFor("en");

async function expectDenied(
  page: Parameters<typeof signInSeededAccount>[0],
  body: string,
) {
  await expect(
    page.getByRole("heading", { name: messages.access.deniedTitle }).first(),
  ).toBeVisible();
  await expect(page.getByText(body)).toBeVisible();
}

test("@phase-1 unauthenticated workspace access redirects safely", async ({
  page,
}) => {
  await page.goto("/en/client");
  await expect(page).toHaveURL(/\/en\/login$/);
});

test("@phase-1 unverified account is denied", async ({ page }) => {
  const email = `phase1-unverified-${crypto.randomUUID()}@example.test`;
  await page.goto("/en/register/client");
  await page.getByLabel(messages.auth.name).fill("Unverified Client");
  await page.getByLabel(messages.auth.email).fill(email);
  await page.getByLabel(messages.auth.password).fill(phaseOnePassword());
  await page.getByRole("button", { name: messages.auth.createAccount }).click();
  await expect(
    page.getByRole("heading", { name: messages.auth.verificationSentTitle }),
  ).toBeVisible();
  await page.goto("/en/client");
  await expect(page).toHaveURL(/\/en\/login$/);
});

test("@phase-1 onboarding-incomplete account is denied", async ({ page }) => {
  await signInSeededAccount(page, "incomplete");
  await page.goto("/en/client");
  await expectDenied(page, messages.access.onboardingIncomplete);
});

test("@phase-1 client and provider capabilities cannot cross workspaces", async ({
  page,
}) => {
  await signInSeededAccount(page, "client");
  await page.goto("/en/provider");
  await expectDenied(page, messages.access.capabilityMissing);
  await page.context().clearCookies();

  await signInSeededAccount(page, "provider");
  await page.goto("/en/client");
  await expectDenied(page, messages.access.capabilityMissing);
});

test("@phase-1 disabled and restricted accounts are denied", async ({
  page,
}) => {
  await signInSeededAccount(page, "disabled");
  await page.goto("/en/client");
  await expectDenied(page, messages.access.accountDisabled);
  await page.context().clearCookies();

  await signInSeededAccount(page, "restricted");
  await page.goto("/en/client");
  await expectDenied(page, messages.access.accountRestricted);
});

test("@phase-1 dual account switches workspaces without another login", async ({
  page,
}) => {
  await signInSeededAccount(page, "dual");
  await expect(page).toHaveURL(/\/en\/client$/);
  await page
    .getByRole("link", { name: messages.workspace.openProvider })
    .click();
  await expect(page).toHaveURL(/\/en\/provider$/);
  await expect(
    page.getByRole("heading", {
      name: messages.workspace.providerTitle,
      exact: true,
    }),
  ).toBeVisible();
});

test("@phase-1 forged identity and authorization fields are rejected", async ({
  page,
}) => {
  await signInSeededAccount(page, "client");
  const beforeResponse = await page.request.get("/api/profile/me");
  expect(beforeResponse.status()).toBe(200);
  const before = await beforeResponse.json();

  const forged = await page.request.patch("/api/profile/me", {
    data: {
      city: "Forged City",
      userId: "attacker-controlled-user",
      capabilities: ["ADMIN"],
      restrictedUntil: null,
    },
  });
  expect(forged.status()).toBe(400);
  await expect(forged.json()).resolves.toMatchObject({ code: "INVALID_INPUT" });

  const afterResponse = await page.request.get("/api/profile/me");
  expect(afterResponse.status()).toBe(200);
  expect(await afterResponse.json()).toEqual(before);
});
