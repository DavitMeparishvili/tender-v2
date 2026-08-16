import { expect, test } from "@playwright/test";
import { messagesFor, signInSeededAccount } from "./fixtures/accounts";
import { SEEDED_CLIENT } from "./fixtures/tenders";
import { publishTenderAsClient, warmUpBiddingRoutes } from "./fixtures/bidding";

test.beforeAll(async ({ request }) => {
  await warmUpBiddingRoutes(request);
});

for (const locale of ["ka", "en"] as const) {
  const messages = messagesFor(locale);

  test(`@phase-3 a provider unlocks a tender, offers, and revises (${locale})`, async ({
    browser,
    page,
  }, testInfo) => {
    // Its own tender per run: this test buys access and sends an offer, and
    // it runs once per locale per project. A shared seeded tender would make
    // the second run hit ALREADY_ENTITLED and BID_ALREADY_EXISTS.
    const title = `Phase 3 unlock journey ${locale} ${testInfo.project.name}`;
    const tenderId = await publishTenderAsClient(browser, locale, title);

    await signInSeededAccount(page, "provider", locale);
    await page.goto(`/${locale}/provider/tenders/${tenderId}`);

    // Establish identity BEFORE any negative assertion, so the locked-state
    // checks cannot pass against a page that never loaded.
    await expect(page.locator("h1")).toContainText(title);

    // Locked: no bid form, and the exact address is absent.
    await expect(
      page.getByRole("button", { name: messages.bidding.submit }),
    ).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("12 Rustaveli Avenue");
    await expect(page.locator("body")).not.toContainText(SEEDED_CLIENT.email);
    await expect(
      page.getByText(messages.entitlements.mockNotice),
    ).toBeVisible();

    // Unlock through the two-step mock checkout.
    await page
      .getByRole("button", { name: messages.entitlements.unlockSingle })
      .click();
    await expect(page.getByText("12 Rustaveli Avenue")).toBeVisible({
      timeout: 15_000,
    });

    // Sending an offer is free once access is held.
    await page
      .getByLabel(messages.bidding.amount, { exact: true })
      .fill("3900");
    await page
      .getByLabel(messages.bidding.conditions, { exact: true })
      .fill(
        "Materials and labour are included; scaffolding is excluded from this price.",
      );
    await page.getByRole("button", { name: messages.bidding.submit }).click();
    // The unlock panel's own "Full details unlocked." banner is also a
    // permanent `role="status"` element on this page, so the bid form's
    // transient status is matched by its text rather than by role alone.
    await expect(
      page.getByRole("status").filter({ hasText: messages.bidding.submitted }),
    ).toBeVisible({ timeout: 15_000 });

    // A second offer is refused, so revision is the only way to change a
    // price — and the revision itself must be accepted before the deadline.
    await expect(
      page.getByRole("button", { name: messages.bidding.submit }),
    ).toHaveCount(0);
    await expect(
      page.getByText(messages.bidding.revisionResetsQueue),
    ).toBeVisible();
    await page
      .getByLabel(messages.bidding.amount, { exact: true })
      .fill("3600");
    await page.getByRole("button", { name: messages.bidding.revise }).click();
    await expect(
      page.getByRole("status").filter({ hasText: messages.bidding.revised }),
    ).toBeVisible({ timeout: 15_000 });

    // The competing-offer summary exists and still names nobody. The amount
    // itself is asserted through the API rather than the rendered string,
    // because `Intl.NumberFormat` groups and places the currency symbol
    // differently in ka and en.
    await expect(page.locator(".bid-summary")).toBeVisible();
    await expect(page.locator(".bid-summary")).not.toContainText(
      SEEDED_CLIENT.name,
    );
    const summary = await page.request.get(
      `/api/tenders/${tenderId}/bids/summary`,
    );
    expect(summary.status()).toBe(200);
    await expect(summary.json()).resolves.toEqual({
      summary: {
        bidCount: 1,
        lowestAmountMinorUnits: 360_000,
        currency: "GEL",
      },
    });
  });

  test(`@phase-3 an unentitled provider gets neither full detail nor a bid (${locale})`, async ({
    browser,
    page,
  }, testInfo) => {
    const title = `Phase 3 locked journey ${locale} ${testInfo.project.name}`;
    const tenderId = await publishTenderAsClient(browser, locale, title);

    await signInSeededAccount(page, "provider", locale);
    // `page.request` shares the signed-in context's cookies; the standalone
    // `request` fixture does not and would be rejected as unauthenticated.
    const detail = await page.request.get(`/api/tenders/discover/${tenderId}`);
    expect(detail.status()).toBe(200);
    const body = (await detail.json()) as { disclosure: string };
    expect(body.disclosure).toBe("MASKED");

    const raw = await detail.text();
    expect(raw).toContain(title);
    expect(raw).not.toContain("12 Rustaveli Avenue");
    expect(raw).not.toContain("41.7151");
    expect(raw).not.toContain(SEEDED_CLIENT.email);

    // Attachments and a bid are both refused with 402 — the provider can
    // resolve this by buying access, which is what that status means.
    const attachments = await page.request.get(
      `/api/tenders/discover/${tenderId}/attachments`,
    );
    expect(attachments.status()).toBe(402);

    const bid = await page.request.post(`/api/tenders/${tenderId}/bids`, {
      data: {
        amountMinorUnits: 1_000,
        conditions:
          "Materials and labour are included; scaffolding is excluded here.",
      },
    });
    expect(bid.status()).toBe(402);
  });
}
