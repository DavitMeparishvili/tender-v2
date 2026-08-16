import { expect, test } from "@playwright/test";
import { messagesFor, signInSeededAccount } from "./fixtures/accounts";
import {
  PHASE_3_DUE_TENDER,
  PHASE_3_WINNING_AMOUNT,
  findOwnedTenderIdByTitle,
  selectionWorkerSecret,
  warmUpBiddingRoutes,
} from "./fixtures/bidding";

test.beforeAll(async ({ request }) => {
  await warmUpBiddingRoutes(request);
});

test("@phase-3 the worker rejects a caller without the shared secret", async ({
  request,
}) => {
  const unauthorized = await request.post("/api/tenders/selection/run");
  expect(unauthorized.status()).toBe(401);

  const wrongSecret = await request.post("/api/tenders/selection/run", {
    headers: { "x-selection-worker-secret": "not-the-secret" },
  });
  expect(wrongSecret.status()).toBe(401);
});

for (const locale of ["ka", "en"] as const) {
  const messages = messagesFor(locale);

  test(`@phase-3 selection produces exactly one winner and is idempotent (${locale})`, async ({
    page,
    request,
  }) => {
    const headers = { "x-selection-worker-secret": selectionWorkerSecret() };

    const first = await request.post("/api/tenders/selection/run", { headers });
    expect(first.status()).toBe(200);
    const second = await request.post("/api/tenders/selection/run", {
      headers,
    });
    expect(second.status()).toBe(200);
    // Every sweep after the first finds nothing: a settled tender is no
    // longer due, so it is never listed again. This is the browser-level
    // proof of the "re-running creates no new side effects" exit criterion,
    // and it also makes this whole spec re-runnable.
    await expect(second.json()).resolves.toEqual({ selections: [] });

    await signInSeededAccount(page, "client", locale);
    const tenderId = await findOwnedTenderIdByTitle(page, PHASE_3_DUE_TENDER);
    await page.goto(`/${locale}/client/tenders/${tenderId}`);

    await expect(page.locator("h1")).toContainText(PHASE_3_DUE_TENDER);
    await expect(
      page.getByText(messages.bidding.outcomeWinnerTitle),
    ).toBeVisible();
    await expect(
      page.getByText(messages.bidding.automaticWinner),
    ).toBeVisible();
    // Exactly one winner on the page, stated in text.
    await expect(
      page.getByText(messages.bidding.statusWinner, { exact: true }),
    ).toHaveCount(1);
    // No control on this page can choose or replace a provider.
    await expect(
      page.getByRole("button", { name: /select|choose/i }),
    ).toHaveCount(0);

    // The lowest seeded offer, and only it, won. Asserted through the
    // comparison API rather than the rendered string, because
    // `Intl.NumberFormat` formats GEL differently in ka and en.
    const compared = await page.request.get(`/api/tenders/${tenderId}/bids`);
    expect(compared.status()).toBe(200);
    const { bids } = (await compared.json()) as {
      bids: ReadonlyArray<{ amountMinorUnits: number; status: string }>;
    };
    const winners = bids.filter((bid) => bid.status === "WINNER");
    expect(winners).toHaveLength(1);
    expect(winners[0]?.amountMinorUnits).toBe(PHASE_3_WINNING_AMOUNT);
    expect(bids.filter((bid) => bid.status === "LOST")).toHaveLength(2);
  });

  test(`@phase-3 a losing provider sees its own outcome after the deadline (${locale})`, async ({
    browser,
    page,
    request,
  }) => {
    await request.post("/api/tenders/selection/run", {
      headers: { "x-selection-worker-secret": selectionWorkerSecret() },
    });

    // The tender id has to come from the owner, so it is read in a separate
    // context signed in as the client, then used by the provider below.
    const clientContext = await browser.newContext();
    let tenderId: string;
    try {
      const clientPage = await clientContext.newPage();
      await signInSeededAccount(clientPage, "client", locale);
      tenderId = await findOwnedTenderIdByTitle(clientPage, PHASE_3_DUE_TENDER);
    } finally {
      await clientContext.close();
    }

    // The seeded Phase 1 provider submitted the highest of the three offers,
    // so it lost — and must still be able to open the tender it bid on even
    // though the deadline has passed and discovery no longer lists it.
    await signInSeededAccount(page, "provider", locale);
    const listed = await page.request.get("/api/tenders/discover?city=tbilisi");
    const { tenders } = (await listed.json()) as {
      tenders: ReadonlyArray<{ title: string }>;
    };
    // A settled tender never reappears as biddable inventory.
    expect(tenders.some((tender) => tender.title === PHASE_3_DUE_TENDER)).toBe(
      false,
    );

    await page.goto(`/${locale}/provider/tenders/${tenderId}`);
    await expect(page.locator("h1")).toContainText(PHASE_3_DUE_TENDER);
    await expect(
      page.getByText(messages.bidding.outcomeLostBody),
    ).toBeVisible();
    // A loser is told they lost, never who won or for how much.
    await expect(page.getByText(messages.bidding.outcomeWonBody)).toHaveCount(
      0,
    );
    // And bidding is over: no offer control remains.
    await expect(
      page.getByRole("button", { name: messages.bidding.submit }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: messages.bidding.revise }),
    ).toHaveCount(0);
  });
}
