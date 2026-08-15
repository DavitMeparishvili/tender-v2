import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import type { Locale } from "../../../modules/localization/config";
import { formatGeorgiaDateTimeLocal } from "../../../modules/tenders/ui/georgia-date-time";

// Sign-in comes from `signInSeededAccount` in `./accounts.ts` — this module
// holds only what Phase 2 genuinely adds: fixture file paths, the seeded
// published tender's real field values, and a Scope & budget step filler.

export function fixtureFile(name: string): string {
  return fileURLToPath(new URL(`../fixtures/files/${name}`, import.meta.url));
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
  await page
    .getByLabel(messages.tenders.deadline, { exact: true })
    .fill(formatGeorgiaDateTimeLocal(deadline));
}
