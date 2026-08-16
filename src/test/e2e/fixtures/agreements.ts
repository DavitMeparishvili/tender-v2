import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Locale } from "../../../modules/localization/config";

export const PHASE_4_TENDER_TITLE = "Phase 3 tender whose deadline has passed";

const run = promisify(execFile);

export async function resetPhase4Fixture(): Promise<void> {
  await run(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/seed-phase-04.ts"],
    {
      cwd: process.cwd(),
      env: process.env,
    },
  );
}

export type Phase4Agreement = Readonly<{
  id: string;
  clientId: string;
  providerId: string;
  status: string;
  snapshot: Readonly<{ tenderTitle: string }>;
}>;

export async function warmUpAgreementRoutes(
  request: APIRequestContext,
): Promise<void> {
  for (const locale of ["ka", "en"] as const) {
    await request.get(
      `/${locale}/agreements/00000000-0000-0000-0000-000000000000`,
    );
    await request.get(`/${locale}/notifications`);
  }
  await request.get("/api/agreements?role=PROVIDER");
  await request.get("/api/notifications");
}

export async function phase4Agreement(
  page: Page,
  role: "CLIENT" | "PROVIDER",
): Promise<Phase4Agreement> {
  const response = await page.request.get(`/api/agreements?role=${role}`);
  if (!response.ok()) {
    throw new Error(`Could not list agreements: ${response.status()}`);
  }
  const { agreements } = (await response.json()) as {
    agreements: readonly Phase4Agreement[];
  };
  const agreement = agreements.find(
    (item) => item.snapshot.tenderTitle === PHASE_4_TENDER_TITLE,
  );
  if (agreement === undefined) {
    throw new Error(
      "The Phase 4 agreement is missing. Run `pnpm seed:phase-4` first.",
    );
  }
  return agreement;
}

export async function agreementStatus(
  page: Page,
  agreementId: string,
): Promise<string> {
  const response = await page.request.get(`/api/agreements/${agreementId}`);
  expect(response.status()).toBe(200);
  const { agreement } = (await response.json()) as {
    agreement: Readonly<{ status: string }>;
  };
  return agreement.status;
}

export async function openPhase4Agreement(
  page: Page,
  locale: Locale,
  role: "CLIENT" | "PROVIDER",
): Promise<Phase4Agreement> {
  const agreement = await phase4Agreement(page, role);
  await page.goto(`/${locale}/agreements/${agreement.id}`);
  return agreement;
}

export async function clickAgreementAction(page: Page, label: string) {
  const response = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "PATCH" &&
      /\/api\/agreements\/[\w-]+$/u.test(new URL(candidate.url()).pathname),
  );
  await page.getByRole("button", { name: label, exact: true }).click();
  expect((await response).status()).toBe(200);
}

export async function keyboardAgreementAction(page: Page, label: string) {
  const response = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "PATCH" &&
      /\/api\/agreements\/[\w-]+$/u.test(new URL(candidate.url()).pathname),
  );
  const button = page.getByRole("button", { name: label, exact: true });
  await button.focus();
  await page.keyboard.press("Enter");
  expect((await response).status()).toBe(200);
}
