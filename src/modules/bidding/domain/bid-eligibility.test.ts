import { describe, expect, it } from "vitest";
import { bidIneligibility, eligibleBids } from "./bid-eligibility";
import type { BidTenderTerms, RankableBid } from "./bid";

const terms: BidTenderTerms = {
  currency: "GEL",
  deadline: new Date("2026-07-01T09:00:00.000Z"),
};

function bid(overrides: Partial<RankableBid>): RankableBid {
  return {
    id: "bid-1",
    amountMinorUnits: 50_000,
    currency: "GEL",
    status: "SUBMITTED",
    qualifyingSubmittedAt: new Date("2026-06-10T00:00:00.000Z"),
    ...overrides,
  };
}

describe("bidIneligibility", () => {
  it("accepts a submitted bid in the tender's currency before the deadline", () => {
    expect(bidIneligibility(bid({}), terms)).toBeNull();
  });

  it("rejects a withdrawn bid", () => {
    expect(bidIneligibility(bid({ status: "WITHDRAWN" }), terms)).toBe(
      "WITHDRAWN",
    );
  });

  it("rejects a bid in a different currency", () => {
    expect(bidIneligibility(bid({ currency: "USD" }), terms)).toBe(
      "CURRENCY_MISMATCH",
    );
  });

  it("rejects a non-positive amount", () => {
    expect(bidIneligibility(bid({ amountMinorUnits: 0 }), terms)).toBe(
      "NON_POSITIVE_AMOUNT",
    );
    expect(bidIneligibility(bid({ amountMinorUnits: -1 }), terms)).toBe(
      "NON_POSITIVE_AMOUNT",
    );
  });

  it("rejects a bid that qualified at or after the deadline instant", () => {
    expect(
      bidIneligibility(bid({ qualifyingSubmittedAt: terms.deadline }), terms),
    ).toBe("SUBMITTED_AFTER_DEADLINE");
    expect(
      bidIneligibility(
        bid({ qualifyingSubmittedAt: new Date("2026-07-01T09:00:01.000Z") }),
        terms,
      ),
    ).toBe("SUBMITTED_AFTER_DEADLINE");
  });

  it("treats an already-ranked bid as still eligible so re-running is stable", () => {
    expect(bidIneligibility(bid({ status: "WINNER" }), terms)).toBeNull();
    expect(bidIneligibility(bid({ status: "LOST" }), terms)).toBeNull();
  });
});

describe("eligibleBids", () => {
  it("keeps only the eligible bids and preserves nothing else", () => {
    const kept = bid({ id: "keep" });
    const dropped = bid({ id: "drop", status: "WITHDRAWN" });
    expect(eligibleBids([kept, dropped], terms)).toEqual([kept]);
  });
});
