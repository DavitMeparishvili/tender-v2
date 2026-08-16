import { describe, expect, it } from "vitest";
import type { BidTenderTerms, RankableBid } from "./bid";
import { rankBids, selectWinningBid } from "./ranking";

const terms: BidTenderTerms = {
  currency: "GEL",
  deadline: new Date("2026-07-01T09:00:00.000Z"),
};

function bid(
  id: string,
  amountMinorUnits: number,
  isoSubmittedAt: string,
): RankableBid {
  return {
    id,
    amountMinorUnits,
    currency: "GEL",
    status: "SUBMITTED",
    qualifyingSubmittedAt: new Date(isoSubmittedAt),
  };
}

describe("rankBids", () => {
  it("ranks by amount ascending", () => {
    const ranked = rankBids(
      [
        bid("expensive", 90_000, "2026-06-01T00:00:00.000Z"),
        bid("cheap", 10_000, "2026-06-03T00:00:00.000Z"),
        bid("middle", 50_000, "2026-06-02T00:00:00.000Z"),
      ],
      terms,
    );
    expect(ranked.map((entry) => entry.id)).toEqual([
      "cheap",
      "middle",
      "expensive",
    ]);
  });

  it("breaks an equal amount by the earliest qualifying submission", () => {
    const ranked = rankBids(
      [
        bid("late", 10_000, "2026-06-03T00:00:00.000Z"),
        bid("early", 10_000, "2026-06-01T00:00:00.000Z"),
      ],
      terms,
    );
    expect(ranked.map((entry) => entry.id)).toEqual(["early", "late"]);
  });

  it("breaks an identical amount and timestamp by stable id ascending", () => {
    const ranked = rankBids(
      [
        bid("bbb", 10_000, "2026-06-01T00:00:00.000Z"),
        bid("aaa", 10_000, "2026-06-01T00:00:00.000Z"),
      ],
      terms,
    );
    expect(ranked.map((entry) => entry.id)).toEqual(["aaa", "bbb"]);
  });

  it("drops ineligible bids before ranking", () => {
    const ranked = rankBids(
      [
        {
          ...bid("withdrawn", 1_000, "2026-06-01T00:00:00.000Z"),
          status: "WITHDRAWN",
        },
        bid("valid", 10_000, "2026-06-01T00:00:00.000Z"),
      ],
      terms,
    );
    expect(ranked.map((entry) => entry.id)).toEqual(["valid"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      bid("b", 20_000, "2026-06-01T00:00:00.000Z"),
      bid("a", 10_000, "2026-06-01T00:00:00.000Z"),
    ];
    const snapshot = input.map((entry) => entry.id);
    rankBids(input, terms);
    expect(input.map((entry) => entry.id)).toEqual(snapshot);
  });
});

describe("selectWinningBid", () => {
  it("returns the first ranked bid", () => {
    const winner = selectWinningBid(
      [
        bid("expensive", 90_000, "2026-06-01T00:00:00.000Z"),
        bid("cheap", 10_000, "2026-06-02T00:00:00.000Z"),
      ],
      terms,
    );
    expect(winner?.id).toBe("cheap");
  });

  it("returns null when no bid is eligible", () => {
    expect(selectWinningBid([], terms)).toBeNull();
    expect(
      selectWinningBid(
        [{ ...bid("x", 10_000, "2026-06-01T00:00:00.000Z"), currency: "USD" }],
        terms,
      ),
    ).toBeNull();
  });
});
