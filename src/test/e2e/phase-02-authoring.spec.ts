import { expect, test } from "@playwright/test";
import { messagesFor, signInSeededAccount } from "./fixtures/accounts";
import {
  fillScopeStep,
  fixtureFile,
  warmUpDevServer,
} from "./fixtures/tenders";

// See `warmUpDevServer`'s own comment: this keeps this file
// independently runnable against a cold `next dev` server.
test.beforeAll(async ({ request }) => {
  await warmUpDevServer(request);
});

for (const locale of ["ka", "en"] as const) {
  const messages = messagesFor(locale);

  test(`@phase-2 client authors, uploads, pins, and publishes a tender (${locale})`, async ({
    page,
  }) => {
    await signInSeededAccount(page, "client", locale);
    await page.goto(`/${locale}/client/tenders/new`);

    await page
      .getByLabel(messages.tenders.title, { exact: true })
      .fill("Repaint two bedrooms");
    await page.getByRole("button", { name: messages.common.continue }).click();

    await fillScopeStep(page, locale);
    await page.getByRole("button", { name: messages.common.continue }).click();

    await page
      .getByLabel(messages.tenders.city, { exact: true })
      .fill("Tbilisi");

    // Pick the location by clicking the map rather than typing coordinates.
    // The wizard's map opens on the Georgia overview — centred exactly on
    // Tbilisi at zoom 7 (src/modules/tenders/ui/location-map-view.ts) — so a
    // click near its centre always resolves within the gazetteer's 150 km
    // reverse-geocoding radius. Leaflet fetches basemap tiles from
    // tile.openstreetmap.org, which a network-restricted CI runner cannot
    // reach, so this waits for Leaflet's own container class rather than
    // `networkidle` (which would never resolve here) or the tile imagery
    // itself.
    // Leaflet adds its own "leaflet-container" class directly onto the
    // container element it's given — not a nested child — so this waits for
    // that class on `.location-map` itself, not a `.leaflet-container`
    // descendant.
    const map = page.locator(".wizard-map .location-map");
    await expect(map).toHaveClass(/leaflet-container/, { timeout: 15_000 });
    // A locator click (rather than `page.mouse.click` at a pre-computed
    // absolute position) re-resolves the element's box immediately before
    // clicking, so a late layout shift (e.g. a web font swap growing the
    // page between measuring and clicking) can't make the click land
    // outside the map.
    await map.click({ position: { x: 100, y: 100 } });

    // Clicking the map is the same act as ticking "Choose on map": both the
    // checkbox and the coordinate fields it feeds must reflect the pick.
    await expect(
      page.getByLabel(messages.tenders.chooseOnMap, { exact: true }),
    ).toBeChecked();
    const latitude = Number(
      await page
        .getByLabel(messages.tenders.latitude, { exact: true })
        .inputValue(),
    );
    const longitude = Number(
      await page
        .getByLabel(messages.tenders.longitude, { exact: true })
        .inputValue(),
    );
    expect(latitude).toBeGreaterThan(-90);
    expect(latitude).toBeLessThan(90);
    expect(longitude).toBeGreaterThan(-180);
    expect(longitude).toBeLessThan(180);

    await page
      .getByLabel(messages.tenders.uploadAttachment, { exact: true })
      .setInputFiles(fixtureFile("valid.pdf"));
    await expect(page.getByText("valid.pdf")).toBeVisible();
    await page
      .getByLabel(messages.tenders.uploadAttachment, { exact: true })
      .setInputFiles(fixtureFile("valid.jpg"));
    await expect(page.getByText("valid.jpg")).toBeVisible();
    await page.getByRole("button", { name: messages.common.continue }).click();

    await page.getByRole("button", { name: messages.tenders.publish }).click();
    // Scoped to the status badge itself: "Published at" (the timestamp
    // label rendered lower on the same detail page) also contains the
    // word "Published", which would make an unscoped text search ambiguous.
    await expect(page.locator(".tender-detail-status")).toContainText(
      messages.tenders.statusPublished,
    );

    // The owner's own tender detail page is where an upload can be observed
    // after the fact.
    const attachments = page.locator(".tender-attachments");
    await expect(attachments).toContainText("valid.pdf");
    await expect(attachments).toContainText("valid.jpg");

    // The owner sees the exact location as a pin, never the provider-side
    // approximate-area circle.
    await expect(page.locator(".tender-map .location-map-pin")).toBeAttached();
    await expect(
      page.locator(".tender-map path.location-map-area"),
    ).toHaveCount(0);
  });

  test(`@phase-2 rejects an oversized and a spoofed attachment (${locale})`, async ({
    page,
  }) => {
    await signInSeededAccount(page, "client", locale);
    await page.goto(`/${locale}/client/tenders/new`);
    await page
      .getByLabel(messages.tenders.title, { exact: true })
      .fill("Small repair job");
    await page.getByRole("button", { name: messages.common.continue }).click();
    await fillScopeStep(page, locale);
    await page.getByRole("button", { name: messages.common.continue }).click();

    // Scoped to the form's own error summary rather than `getByRole("alert")`
    // alone: Next.js's client-side route announcer
    // (`#__next-route-announcer__`) also carries `role="alert"`, which would
    // otherwise make this a strict-mode violation.
    const errorSummary = page.locator("#form-errors");
    await page
      .getByLabel(messages.tenders.uploadAttachment, { exact: true })
      .setInputFiles(fixtureFile("oversized.jpg"));
    await expect(errorSummary).toContainText(
      messages.tenders.errors.fileTooLarge,
    );

    // A JPEG's own magic bytes make it an allowed upload no matter its
    // extension, so proving rejection requires content whose signature
    // matches nothing allowed — not merely a mismatched file name.
    await page
      .getByLabel(messages.tenders.uploadAttachment, { exact: true })
      .setInputFiles(fixtureFile("spoofed.pdf"));
    await expect(errorSummary).toContainText(
      messages.tenders.errors.unsupportedFileType,
    );
  });
}
