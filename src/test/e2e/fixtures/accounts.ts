import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Locale } from "../../../modules/localization/config";
import type { Messages } from "../../../modules/localization/get-messages";

export const seededAccounts = {
  client: "phase1.client@tender.test",
  provider: "phase1.provider@tender.test",
  providerB: "phase3.provider.b@tender.test",
  admin: "phase4.admin@tender.test",
  dual: "phase1.dual@tender.test",
  unverified: "phase1.unverified@tender.test",
  incomplete: "phase1.incomplete@tender.test",
  restricted: "phase1.restricted@tender.test",
  disabled: "phase1.disabled@tender.test",
} as const;

type JourneyKind = "client" | "provider";

const messagesByLocale = Object.fromEntries(
  (["ka", "en"] as const).map((locale) => [
    locale,
    JSON.parse(
      readFileSync(
        new URL(
          `../../../modules/localization/messages/${locale}.json`,
          import.meta.url,
        ),
        "utf8",
      ),
    ) as Messages,
  ]),
) as Record<Locale, Messages>;

export function messagesFor(locale: Locale): Messages {
  return messagesByLocale[locale];
}

type MailboxResponse = Readonly<{
  message: Readonly<{
    variables: Readonly<{ verificationUrl?: unknown }>;
  }>;
}>;

export function phaseOnePassword(): string {
  const password = process.env.PHASE_1_SEED_PASSWORD;
  if (password === undefined || password.length < 12) {
    throw new Error(
      "PHASE_1_SEED_PASSWORD must contain at least 12 characters",
    );
  }
  return password;
}

function testIdentity(kind: JourneyKind, locale: Locale, project: string) {
  const nonce = crypto.randomUUID();
  const safeProject = project.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const digits = nonce.replace(/\D/g, "").padEnd(8, "7").slice(0, 8);
  return {
    email: `phase1-${kind}-${locale}-${safeProject}-${nonce}@example.test`,
    name: `${kind === "client" ? "Client" : "Provider"} ${locale.toUpperCase()}`,
    updatedName: `${kind === "client" ? "Client" : "Provider"} ${locale.toUpperCase()} Updated`,
    phone: `+9955${digits}`,
  };
}

async function verificationUrlFor(
  request: APIRequestContext,
  email: string,
): Promise<string> {
  const endpoint =
    "/api/test/mailbox?address=" +
    encodeURIComponent(email) +
    "&template=VERIFY_EMAIL";
  await expect
    .poll(async () => (await request.get(endpoint)).status())
    .toBe(200);
  const response = await request.get(endpoint);
  const body = (await response.json()) as MailboxResponse;
  expect(body.message.variables.verificationUrl).toEqual(expect.any(String));
  return body.message.variables.verificationUrl as string;
}

export async function signInSeededAccount(
  page: Page,
  account: keyof typeof seededAccounts,
  locale: Locale = "en",
): Promise<void> {
  const messages = messagesFor(locale);
  await page.goto(`/${locale}/login`);
  await page.getByLabel(messages.auth.email).fill(seededAccounts[account]);
  await page.getByLabel(messages.auth.password).fill(phaseOnePassword());
  await page.getByRole("button", { name: messages.auth.signIn }).click();
  await expect(page).not.toHaveURL(new RegExp(`/${locale}/login`), {
    timeout: 15_000,
  });
}

export async function runAccountJourney(
  page: Page,
  request: APIRequestContext,
  projectName: string,
  locale: Locale,
  kind: JourneyKind,
): Promise<void> {
  const messages = messagesFor(locale);
  const identity = testIdentity(kind, locale, projectName);
  const workspace = kind === "client" ? "client" : "provider";
  const registration = kind === "client" ? "client" : "provider";

  await page.goto(`/${locale}/register/${registration}`);
  await page.getByLabel(messages.auth.name).fill(identity.name);
  await page.getByLabel(messages.auth.email).fill(identity.email);
  await page.getByLabel(messages.auth.password).fill(phaseOnePassword());
  await page.getByRole("button", { name: messages.auth.createAccount }).click();
  await expect(
    page.getByRole("heading", { name: messages.auth.verificationSentTitle }),
  ).toBeVisible();

  await page.goto(await verificationUrlFor(request, identity.email));
  await expect(page).toHaveURL(
    new RegExp(`/${locale}/register/${registration}`),
  );

  await page
    .getByLabel(messages.onboarding.accountKind)
    .selectOption(kind === "provider" ? "COMPANY" : "PERSON");
  await page.getByLabel(messages.onboarding.displayName).fill(identity.name);
  await page.getByLabel(messages.onboarding.phone).fill(identity.phone);
  await page.getByLabel(messages.onboarding.city).fill("Tbilisi");
  await page
    .getByLabel(messages.onboarding.activity)
    .fill(
      kind === "client"
        ? "Residential renovation projects"
        : "Construction and repair services",
    );
  await page
    .getByRole("button", { name: messages.onboarding.complete })
    .click();

  const workspaceTitle =
    kind === "client"
      ? messages.workspace.clientTitle
      : messages.workspace.providerTitle;
  await expect(page).toHaveURL(new RegExp(`/${locale}/${workspace}$`), {
    timeout: 15_000,
  });
  await expect(
    page.getByRole("heading", { name: workspaceTitle, exact: true }),
  ).toBeVisible();

  await page
    .getByRole("link", { name: messages.workspace.editProfile })
    .click();
  const profileForm = page.locator("form.identity-form");
  const displayName = page.getByLabel(messages.onboarding.displayName);
  await expect
    .poll(async () => {
      await displayName.fill(identity.updatedName);
      return profileForm.getAttribute("data-dirty");
    })
    .toBe("true");
  await page.getByRole("button", { name: messages.common.save }).click();
  await expect(page.getByRole("status")).toHaveText(messages.profile.saved, {
    timeout: 15_000,
  });

  await page
    .getByRole("link", { name: messages.profile.backToWorkspace })
    .click();
  await page.getByRole("button", { name: messages.common.signOut }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/login$`));
  await page.goto(`/${locale}/${workspace}`);
  await expect(page).toHaveURL(new RegExp(`/${locale}/login$`));

  await page.getByLabel(messages.auth.email).fill(identity.email);
  await page.getByLabel(messages.auth.password).fill(phaseOnePassword());
  await page.getByRole("button", { name: messages.auth.signIn }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/${workspace}$`), {
    timeout: 15_000,
  });
  await expect(
    page.getByText(identity.updatedName, { exact: false }),
  ).toBeVisible();
}
