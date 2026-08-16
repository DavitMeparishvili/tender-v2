import { fileURLToPath } from "node:url";
import type { APIRequestContext, Page } from "@playwright/test";
import type { Locale } from "../../../modules/localization/config";
import type { Messages } from "../../../modules/localization/get-messages";
import { formatGeorgiaDateTimeLocal } from "../../../modules/tenders/ui/georgia-date-time";

// Sign-in comes from `signInSeededAccount` in `./accounts.ts` — this module
// holds only what Phase 2 genuinely adds: fixture file paths, the seeded
// published tender's real field values, and a Scope & budget step filler.

export function fixtureFile(name: string): string {
  return fileURLToPath(new URL(`../fixtures/files/${name}`, import.meta.url));
}

// The seeded client account that owns every Phase 2 seed tender (see
// scripts/seed-phase-01.ts — the account is created there, not by
// scripts/seed-phase-02.ts, which only looks it up). Used to assert the
// client's identity/contact details never reach a provider, alongside the
// tender-field masking assertions.
export const SEEDED_CLIENT = {
  email: "phase1.client@tender.test",
  name: "Seeded Client",
} as const;

// Outside CI, Playwright's `webServer` runs `next dev`, which compiles each
// route on its first real hit — the `/api/health/live` readiness probe the
// config waits on never touches a page route. Whichever spec file's first
// test happens to run first against a freshly started server pays that
// compile cost against a bare `expect(...)`'s fixed 5-second default
// timeout — first for `signInSeededAccount`'s post-login redirect, then
// again for whichever page that spec navigates to next. Every route these
// two spec files' own tests visit is warmed here (a plain, unauthenticated
// GET still forces Next to compile the route module, redirect or not), and
// both files call this from their own `test.beforeAll` so each is
// independently runnable (e.g. `--grep phase-02-discovery` alone) without
// depending on the other file having already warmed the server up.
const WARM_UP_ROUTES = [
  "/continue",
  "/client/tenders/new",
  "/provider/tenders",
  "/provider/tenders/00000000-0000-0000-0000-000000000000",
] as const;

export async function warmUpDevServer(
  request: APIRequestContext,
): Promise<void> {
  for (const locale of ["ka", "en"] as const) {
    for (const route of WARM_UP_ROUTES) {
      await request.get(`/${locale}${route}`);
    }
  }
}

// The values `scripts/seed-phase-02.ts` actually writes for its PUBLISHED
// tender, so the masking assertions in phase-02-discovery.spec.ts test the
// real seeded data rather than hard-coded literals that could drift out of
// sync with the seed script.
//
// The exact coordinates are not literally written by the seed script; they
// come from geocoding "Tbilisi" through the six-city gazetteer
// (src/modules/tenders/infrastructure/gazetteer-geocoder.ts), which returns
// a fixed {41.7151, 44.8271} for that city name. That geocoder is
// deterministic, so this literal is as stable as if the seed script had
// written it directly.
export const SEEDED_PUBLISHED_TENDER = {
  title: "Renovate two-bedroom apartment interior",
  city: "Tbilisi",
  addressLine: "12 Rustaveli Avenue",
  exactLatitude: "41.7151",
  exactLongitude: "44.8271",
  conditions: "Work must be completed on weekdays between 9am and 5pm only.",
} as const;

// Fills the wizard's "Scope & budget" step (step index 1) with values that
// clear every validation rule in `validateWizardStep` — short/full
// description and scope of work past their minimum lengths, a valid budget
// in GEL, and a bidding deadline comfortably in the future. Currency is
// selected explicitly rather than left on its default, since the wizard can
// silently overwrite an untouched currency field from the signed-in user's
// saved profile preference.
export async function fillScopeStep(page: Page, locale: Locale): Promise<void> {
  const { messagesFor } = await import("./accounts");
  const messages = messagesFor(locale);

  await page
    .getByLabel(messages.tenders.shortDescription, { exact: true })
    .fill("Repaint two bedrooms with fresh, durable paint.");
  await page
    .getByLabel(messages.tenders.fullDescription, { exact: true })
    .fill(
      "Sand and prime the walls in both bedrooms, then apply two coats " +
        "of paint. Cover and protect flooring and fixtures throughout.",
    );
  await page
    .getByLabel(messages.tenders.scopeOfWork, { exact: true })
    .fill("Wall preparation, priming, and painting in two bedrooms.");
  // `exact: true` matters here specifically: this step's own heading is
  // "Scope & budget", so a substring match on "Budget" would also resolve
  // the step's <form aria-labelledby="..."> (which carries that heading as
  // its accessible name) alongside the input, a Playwright strict-mode
  // violation.
  await page.getByLabel(messages.tenders.budget, { exact: true }).fill("1500");
  await page
    .getByLabel(messages.tenders.currency, { exact: true })
    .selectOption("GEL");

  const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await fillWizardDeadline(page, messages, deadline);
}

// The deadline field is a calendar popover paired with a native time input
// rather than a single fillable datetime-local control, so picking a value
// means opening the popover, paging to the target month if it isn't the one
// already showing, clicking the day, then filling the time separately.
async function fillWizardDeadline(
  page: Page,
  messages: Messages,
  deadline: Date,
): Promise<void> {
  const [datePart, timePart] = formatGeorgiaDateTimeLocal(deadline).split("T");
  await page.getByLabel(messages.tenders.deadline, { exact: true }).click();
  const targetDay = page.locator(
    `.date-calendar-day[data-key="${datePart}"]:not([data-outside])`,
  );
  const nextMonth = page.getByRole("button", {
    name: messages.tenders.datePickerNextMonth,
  });
  for (let attempt = 0; attempt < 6 && (await targetDay.count()) === 0; attempt += 1) {
    await nextMonth.click();
  }
  await targetDay.click();
  await page.getByLabel(messages.tenders.datePickerTime).fill(timePart ?? "");
}
