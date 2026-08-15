import { expect, test } from "@playwright/test";
import { messagesFor, signInSeededAccount } from "./fixtures/accounts";
import { SEEDED_PUBLISHED_TENDER } from "./fixtures/tenders";

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

    await page
      .getByRole("link", { name: messages.tenders.viewDetail })
      .first()
      .click();
    const body = page.locator("body");
    await expect(body).not.toContainText(SEEDED_PUBLISHED_TENDER.addressLine);
    await expect(body).not.toContainText(SEEDED_PUBLISHED_TENDER.exactLatitude);
    await expect(body).not.toContainText(
      SEEDED_PUBLISHED_TENDER.exactLongitude,
    );
    await expect(body).not.toContainText(SEEDED_PUBLISHED_TENDER.conditions);
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
  });
}
