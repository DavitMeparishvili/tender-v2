import { describe, expect, it } from "vitest";
import type { BidTenderTerms, RankableBid } from "./bid";
import { summarizeBids } from "./bid-summary";

const terms: BidTenderTerms = {
  currency: "GEL",
  deadline: new Date("2026-07-01T09:00:00.000Z"),
};

function bid(id: string, amountMinorUnits: number): RankableBid {
  return {
    id,
    amountMinorUnits,
    currency: "GEL",
    status: "SUBMITTED",
    qualifyingSubmittedAt: new Date("2026-06-01T00:00:00.000Z"),
  };
}

describe("summarizeBids", () => {
  it("reports the eligible count and the current lowest amount", () => {
    expect(summarizeBids([bid("a", 30_000), bid("b", 10_000)], terms)).toEqual({
      bidCount: 2,
      lowestAmountMinorUnits: 10_000,
      currency: "GEL",
    });
  });

  it("reports an empty tender without inventing a lowest amount", () => {
    expect(summarizeBids([], terms)).toEqual({
      bidCount: 0,
      lowestAmountMinorUnits: null,
      currency: "GEL",
    });
  });

  it("excludes withdrawn bids from both the count and the lowest", () => {
    const withdrawn = { ...bid("gone", 1_000), status: "WITHDRAWN" as const };
    expect(summarizeBids([withdrawn, bid("live", 10_000)], terms)).toEqual({
      bidCount: 1,
      lowestAmountMinorUnits: 10_000,
      currency: "GEL",
    });
  });

  it("carries no bidder identity, terms, or submission time", () => {
    const summary = summarizeBids([bid("secret-provider-bid", 10_000)], terms);
    expect(Object.keys(summary).sort()).toEqual([
      "bidCount",
      "currency",
      "lowestAmountMinorUnits",
    ]);
    expect(JSON.stringify(summary)).not.toContain("secret-provider-bid");
  });
});
