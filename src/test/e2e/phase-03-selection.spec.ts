import { expect, test, type APIRequestContext } from "@playwright/test";
import { messagesFor, signInSeededAccount } from "./fixtures/accounts";
import {
  PHASE_3_CHOSEN_AMOUNT,
  PHASE_3_DUE_TENDER,
  findOwnedTenderIdByTitle,
  selectionWorkerSecret,
  warmUpBiddingRoutes,
} from "./fixtures/bidding";

test.beforeAll(async ({ request }) => {
  await warmUpBiddingRoutes(request);
});

// The specs below share one seeded tender and change its state: the client
// chooses once, in the first project that reaches that spec. Later runs (the
// mobile project, a re-run without reseeding) see the chosen state instead.
async function alreadyChosen(
  request: APIRequestContext,
  tenderId: string,
): Promise<boolean> {
  const response = await request.get(`/api/tenders/${tenderId}/bids`);
  const { bids } = (await response.json()) as {
    bids: ReadonlyArray<{ status: string }>;
  };
  return bids.some((bid) => bid.status === "WINNER");
}

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

  test(`@phase-3 the deadline sweep never picks a winner; the client is asked to choose (${locale})`, async ({
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
    // Every sweep after the first finds nothing: a tender awaiting the
    // client's choice is not due again until its selection window ends.
    await expect(second.json()).resolves.toEqual({ selections: [] });

    await signInSeededAccount(page, "client", locale);
    const tenderId = await findOwnedTenderIdByTitle(page, PHASE_3_DUE_TENDER);
    await page.goto(`/${locale}/client/tenders/${tenderId}`);

    await expect(page.locator("h1")).toContainText(PHASE_3_DUE_TENDER);
    if (await alreadyChosen(page.request, tenderId)) {
      // The client's own earlier choice, never the sweep's.
      await expect(
        page.getByText(messages.bidding.outcomeWinnerTitle),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: messages.bidding.choose.action }),
      ).toHaveCount(0);
      return;
    }
    await expect(
      page.getByText(messages.bidding.selectionRuleOwner),
    ).toBeVisible();
    // No winner was picked for the client…
    await expect(
      page.getByText(messages.bidding.statusWinner, { exact: true }),
    ).toHaveCount(0);
    // …who can choose any of the three offers.
    await expect(
      page.getByRole("button", { name: messages.bidding.choose.action }),
    ).toHaveCount(3);
    await expect(
      page.getByText(messages.bidding.lowestPrice, { exact: true }),
    ).toHaveCount(1);
  });
}

test("@phase-3 the client chooses a contractor that is not the cheapest", async ({
  page,
}) => {
  const locale = "en";
  const messages = messagesFor(locale);
  await signInSeededAccount(page, "client", locale);
  const tenderId = await findOwnedTenderIdByTitle(page, PHASE_3_DUE_TENDER);
  test.skip(
    await alreadyChosen(page.request, tenderId),
    "The client already chose in an earlier project run.",
  );

  const compared = await page.request.get(`/api/tenders/${tenderId}/bids`);
  const { bids } = (await compared.json()) as {
    bids: ReadonlyArray<{ id: string; amountMinorUnits: number }>;
  };
  const chosen = bids.find(
    (bid) => bid.amountMinorUnits === PHASE_3_CHOSEN_AMOUNT,
  );
  if (chosen === undefined) throw new Error("Seeded offer is missing");

  await page.goto(`/${locale}/client/tenders/${tenderId}`);
  const row = page.locator(`tr[data-bid-id="${chosen.id}"]`);
  await row
    .getByRole("button", { name: messages.bidding.choose.action })
    .click();
  // Two steps: the confirmation explains that choosing closes the tender.
  await expect(
    row.getByText(messages.bidding.choose.confirmBody),
  ).toBeVisible();
  await row
    .getByRole("button", { name: messages.bidding.choose.confirm })
    .click();

  await expect(
    page.getByText(messages.bidding.outcomeWinnerTitle),
  ).toBeVisible();
  await expect(
    page.getByText(messages.bidding.statusWinner, { exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: messages.bidding.choose.action }),
  ).toHaveCount(0);

  const after = await page.request.get(`/api/tenders/${tenderId}/bids`);
  const settled = (
    (await after.json()) as {
      bids: ReadonlyArray<{ id: string; status: string }>;
    }
  ).bids;
  expect(settled.filter((bid) => bid.status === "WINNER")).toEqual([
    expect.objectContaining({ id: chosen.id }),
  ]);
  // The other offers stay on standby while the agreement is pending.
  expect(settled.filter((bid) => bid.status === "SUBMITTED")).toHaveLength(2);
});

for (const locale of ["ka", "en"] as const) {
  const messages = messagesFor(locale);

  test(`@phase-3 a provider on standby sees its offer is on hold (${locale})`, async ({
    browser,
    page,
  }) => {
    // The tender id has to come from the owner, so it is read in a separate
    // context signed in as the client, then used by the provider below.
    const clientContext = await browser.newContext();
    let tenderId: string;
    let agreementConfirmed: boolean;
    try {
      const clientPage = await clientContext.newPage();
      await signInSeededAccount(clientPage, "client", locale);
      tenderId = await findOwnedTenderIdByTitle(clientPage, PHASE_3_DUE_TENDER);
      // In a full run the Phase 4 specs (desktop project) confirm the
      // agreement on this tender before the mobile project gets here. Once
      // it is confirmed, the offers left on standby are closed as LOST.
      const compared = await clientPage.request.get(
        `/api/tenders/${tenderId}/bids`,
      );
      const { bids } = (await compared.json()) as {
        bids: ReadonlyArray<{ status: string }>;
      };
      expect(bids.some((bid) => bid.status === "WINNER")).toBe(true);
      agreementConfirmed = !bids.some((bid) => bid.status === "SUBMITTED");
    } finally {
      await clientContext.close();
    }

    // The seeded Phase 1 provider was not chosen, but its offer stays on
    // standby until the agreement is confirmed — and it must still be able to
    // open the tender it bid on even though discovery no longer lists it.
    await signInSeededAccount(page, "provider", locale);
    const listed = await page.request.get("/api/tenders/discover?city=tbilisi");
    const { tenders } = (await listed.json()) as {
      tenders: ReadonlyArray<{ title: string }>;
    };
    expect(tenders.some((tender) => tender.title === PHASE_3_DUE_TENDER)).toBe(
      false,
    );

    await page.goto(`/${locale}/provider/tenders/${tenderId}`);
    await expect(page.locator("h1")).toContainText(PHASE_3_DUE_TENDER);
    if (agreementConfirmed) {
      await expect(
        page.getByText(messages.bidding.offer.statuses.lost, { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(messages.bidding.outcomeLostBody),
      ).toBeVisible();
    } else {
      await expect(
        page.getByText(messages.bidding.offer.statuses.standby, {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText(messages.bidding.offer.standbyBody),
      ).toBeVisible();
    }
    // A standby bidder is never told who was chosen or for how much.
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
