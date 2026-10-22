import { describe, expect, it } from "vitest";
import type { Bid } from "../domain/bid";
import {
  createListTenderBids,
  type ClientBidView,
  type ListTenderBidsRepository,
} from "./list-tender-bids";

const deadline = new Date("2026-07-01T09:00:00.000Z");
const submittedAt = new Date("2026-06-10T09:00:00.000Z");

function bid(id: string, providerId: string, amountMinorUnits: number): Bid {
  return {
    id,
    tenderId: "tender",
    providerId,
    amountMinorUnits,
    currency: "GEL",
    status: "SUBMITTED",
    proposedStartDate: null,
    durationDays: null,
    includedCosts: null,
    exclusions: null,
    conditions: "Terms",
    qualifyingSubmittedAt: submittedAt,
    withdrawnAt: null,
    createdAt: submittedAt,
    updatedAt: submittedAt,
  };
}

async function listFor(
  bids: readonly Bid[],
  vipProviderIds: readonly string[],
): Promise<readonly ClientBidView[]> {
  const repository: ListTenderBidsRepository = {
    listBids: async () => bids,
  };
  const listTenderBids = createListTenderBids({
    repository,
    tenders: async () => ({
      ok: true,
      value: { ownerId: "client", currency: "GEL", deadline },
    }),
    directory: async (ids) => new Map(ids.map((id) => [id, `Provider ${id}`])),
    vipDirectory: async () => new Set(vipProviderIds),
  });
  const result = await listTenderBids("tender", { id: "client" });
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

// Price rank: std-a (10k), vip-a (20k), std-b (30k), vip-b (40k).
const offers = [
  bid("bid-std-a", "std-a", 10_000),
  bid("bid-vip-a", "vip-a", 20_000),
  bid("bid-std-b", "std-b", 30_000),
  bid("bid-vip-b", "vip-b", 40_000),
];

describe("listTenderBids VIP display order", () => {
  it("lists VIP providers first, and price order within each group", async () => {
    const view = await listFor(offers, ["vip-a", "vip-b"]);

    expect(view.map((row) => row.id)).toEqual([
      "bid-vip-a",
      "bid-vip-b",
      "bid-std-a",
      "bid-std-b",
    ]);
    expect(view.map((row) => row.providerIsVip)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it("keeps the lowest-price flag on the cheapest offer, wherever it is listed", async () => {
    const view = await listFor(offers, ["vip-a", "vip-b"]);

    expect(view.filter((row) => row.lowestPrice).map((row) => row.id)).toEqual([
      "bid-std-a",
    ]);
  });

  it("leaves every lowest-price flag as it was before VIP placement", async () => {
    const withoutVip = await listFor(offers, []);
    const withVip = await listFor(offers, ["vip-a", "vip-b"]);
    const flagById = (rows: readonly ClientBidView[]) =>
      Object.fromEntries(rows.map((row) => [row.id, row.lowestPrice]));

    expect(flagById(withVip)).toEqual(flagById(withoutVip));
  });

  it("keeps withdrawn offers at the bottom even when their provider is VIP", async () => {
    const withdrawnVip = {
      ...bid("bid-vip-withdrawn", "vip-a", 5_000),
      status: "WITHDRAWN" as const,
    };
    const view = await listFor([...offers, withdrawnVip], ["vip-a", "vip-b"]);

    expect(view.map((row) => row.id)).toEqual([
      "bid-vip-a",
      "bid-vip-b",
      "bid-std-a",
      "bid-std-b",
      "bid-vip-withdrawn",
    ]);
    expect(view.find((row) => row.id === "bid-vip-withdrawn")).toMatchObject({
      lowestPrice: false,
      choosable: false,
    });
  });

  it("keeps the price-ranked order when no provider is VIP", async () => {
    const view = await listFor(offers, []);

    expect(view.map((row) => row.id)).toEqual([
      "bid-std-a",
      "bid-vip-a",
      "bid-std-b",
      "bid-vip-b",
    ]);
  });
});
