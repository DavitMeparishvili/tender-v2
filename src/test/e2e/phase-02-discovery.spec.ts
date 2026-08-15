import { expect, test } from "@playwright/test";
import { messagesFor, signInSeededAccount } from "./fixtures/accounts";
import {
  SEEDED_CLIENT,
  SEEDED_PUBLISHED_TENDER,
  warmUpDevServer,
} from "./fixtures/tenders";

// See `warmUpDevServer`'s own comment: this keeps this file
// independently runnable against a cold `next dev` server, regardless of
// whether phase-02-authoring.spec.ts has already run in the same worker.
test.beforeAll(async ({ request }) => {
  await warmUpDevServer(request);
});

for (const locale of ["ka", "en"] as const) {
  const messages = messagesFor(locale);

  test(`@phase-2 provider discovers only masked tender data (${locale})`, async ({
    page,
  }) => {
    await signInSeededAccount(page, "provider", locale);
    await page.goto(`/${locale}/provider/tenders`);
    // Typed lower-case on purpose: the city filter must match the seeded
    // "Tbilisi" tender case-insensitively.
    await page.getByLabel(messages.tenders.filterCity).fill("tbilisi");
    await page
      .getByRole("button", { name: messages.tenders.applyFilters })
      .click();
    await expect(page.getByText(SEEDED_PUBLISHED_TENDER.title)).toBeVisible();

    // Open the SEEDED tender specifically, by its own card, rather than
    // "whichever result comes first". With `workers: 1` and alphabetical
    // file order, phase-02-authoring.spec.ts runs first in the same
    // database and publishes its own Tbilisi tender moments earlier, and
    // `searchPublished` orders results by `publishedAt: "desc"` — so the
    // first result would be the AUTHORING spec's own tender, not this
    // fixture's, and every negative assertion below would trivially pass
    // against the wrong tender's page.
    const seededCard = page
      .locator(".discovery-list li")
      .filter({ hasText: SEEDED_PUBLISHED_TENDER.title });
    // Read the seeded card's own link `href` and navigate there directly,
    // rather than clicking the `<Link>` and waiting for a client-side
    // transition to settle. A click-then-wait pair still leaves room for a
    // race between the click event and whatever confirms navigation
    // happened; reading the href is unambiguous about which tender's page
    // we're about to load, and `page.goto` blocks until it has.
    const detailHref = await seededCard
      .getByRole("link", { name: messages.tenders.viewDetail })
      .getAttribute("href");
    if (detailHref === null) {
      throw new Error(
        "Expected the seeded tender's card to carry a detail link",
      );
    }
    await page.goto(detailHref);

    // Establish identity BEFORE any negative assertion. `expect(...).not.*`
    // is satisfied instantly by whatever is currently in the DOM, so
    // without this the negative assertions below could pass against a page
    // that never actually loaded the seeded tender's content.
    await expect(page.locator("h1")).toContainText(
      SEEDED_PUBLISHED_TENDER.title,
    );

    const body = page.locator("body");
    await expect(body).not.toContainText(SEEDED_PUBLISHED_TENDER.addressLine);
    await expect(body).not.toContainText(SEEDED_PUBLISHED_TENDER.exactLatitude);
    await expect(body).not.toContainText(
      SEEDED_PUBLISHED_TENDER.exactLongitude,
    );
    await expect(body).not.toContainText(SEEDED_PUBLISHED_TENDER.conditions);
    // The client's identity/contact details must never reach a provider
    // either — the same masking layer as the tender fields above.
    await expect(body).not.toContainText(SEEDED_CLIENT.email);
    await expect(body).not.toContainText(SEEDED_CLIENT.name);
    await expect(page.getByText(messages.tenders.attachments)).toHaveCount(0);

    // The masked map draws an approximate-area circle and never a pin —
    // the coarse-circle rule that keeps the exact point unrecoverable.
    await expect(
      page.locator(".tender-map path.location-map-area"),
    ).toBeVisible();
    await expect(page.locator(".tender-map .location-map-pin")).toHaveCount(0);
  });

  test(`@phase-2 the masked discovery API omits exact coordinates (${locale})`, async ({
    page,
  }) => {
    await signInSeededAccount(page, "provider", locale);
    // `page.request` shares the signed-in browser context's cookies; the
    // standalone `request` fixture does not and would be rejected as
    // unauthenticated.
    const response = await page.request.get(
      "/api/tenders/discover?city=tbilisi",
    );
    expect(response.status()).toBe(200);
    const raw = await response.text();
    expect(raw).toContain(SEEDED_PUBLISHED_TENDER.title);
    expect(raw).not.toContain(SEEDED_PUBLISHED_TENDER.exactLatitude);
    expect(raw).not.toContain(SEEDED_PUBLISHED_TENDER.exactLongitude);
    expect(raw).not.toContain(SEEDED_PUBLISHED_TENDER.addressLine);
    expect(raw).not.toContain(SEEDED_CLIENT.email);
    expect(raw).not.toContain(SEEDED_CLIENT.name);
  });
}
