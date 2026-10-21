import { describe, expect, it } from "vitest";
import type { BidTenderTerms, RankableBid } from "./bid";
import {
  addSelectionWindow,
  choosableBids,
  displayedSelectionEnd,
  isChoosableBid,
  isSelectionOpen,
  selectionWindowFromSweep,
} from "./selection";

const terms: BidTenderTerms = {
  currency: "GEL",
  deadline: new Date("2026-07-01T09:00:00.000Z"),
};

function bid(id: string, overrides: Partial<RankableBid> = {}): RankableBid {
  return {
    id,
    amountMinorUnits: 10_000,
    currency: "GEL",
    status: "SUBMITTED",
    qualifyingSubmittedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("isChoosableBid", () => {
  it("accepts an active, eligible offer", () => {
    expect(isChoosableBid(bid("a"), terms)).toBe(true);
  });

  it.each([
    ["withdrawn", { status: "WITHDRAWN" as const }],
    ["already the winner", { status: "WINNER" as const }],
    ["already lost", { status: "LOST" as const }],
    ["in another currency", { currency: "USD" as const }],
    ["non-positive", { amountMinorUnits: 0 }],
    ["late", { qualifyingSubmittedAt: terms.deadline }],
  ])("refuses an offer that is %s", (_, overrides) => {
    expect(isChoosableBid(bid("a", overrides), terms)).toBe(false);
  });

  it("filters a list without reordering it", () => {
    const bids = [
      bid("b", { amountMinorUnits: 20_000 }),
      bid("x", { status: "WITHDRAWN" }),
      bid("a"),
    ];
    expect(choosableBids(bids, terms).map((entry) => entry.id)).toEqual([
      "b",
      "a",
    ]);
  });
});

describe("selection window", () => {
  const deadline = terms.deadline;

  it("adds whole days", () => {
    expect(addSelectionWindow(deadline, 14).toISOString()).toBe(
      "2026-07-15T09:00:00.000Z",
    );
  });

  it("stamps deadline + N, or a full window from a late sweep", () => {
    expect(
      selectionWindowFromSweep(
        deadline,
        new Date("2026-07-02T00:00:00.000Z"),
        14,
      ).toISOString(),
    ).toBe("2026-07-15T09:00:00.000Z");
    // The sweep only arrives on 20 July: never an instant expiry.
    expect(
      selectionWindowFromSweep(
        deadline,
        new Date("2026-07-20T00:00:00.000Z"),
        14,
      ).toISOString(),
    ).toBe("2026-08-03T00:00:00.000Z");
  });

  it("is open while PUBLISHED and until the stamped window ends", () => {
    const now = new Date("2026-07-10T00:00:00.000Z");
    expect(
      isSelectionOpen({ status: "PUBLISHED", selectionExpiresAt: null }, now),
    ).toBe(true);
    expect(
      isSelectionOpen(
        {
          status: "AWAITING_SELECTION",
          selectionExpiresAt: new Date("2026-07-11T00:00:00.000Z"),
        },
        now,
      ),
    ).toBe(true);
    expect(
      isSelectionOpen(
        { status: "AWAITING_SELECTION", selectionExpiresAt: now },
        now,
      ),
    ).toBe(false);
    for (const status of ["CLOSED", "EXPIRED", "CANCELLED", "DRAFT"]) {
      expect(isSelectionOpen({ status, selectionExpiresAt: null }, now)).toBe(
        false,
      );
    }
  });

  it("shows a choose-by date only once bidding has closed", () => {
    const before = new Date("2026-06-30T00:00:00.000Z");
    const after = new Date("2026-07-02T00:00:00.000Z");
    const published = {
      status: "PUBLISHED",
      selectionExpiresAt: null,
      deadline,
    };
    expect(displayedSelectionEnd(published, before, 14)).toBeNull();
    expect(displayedSelectionEnd(published, after, 14)?.toISOString()).toBe(
      "2026-07-15T09:00:00.000Z",
    );
    const stamped = new Date("2026-08-01T00:00:00.000Z");
    expect(
      displayedSelectionEnd(
        { status: "AWAITING_SELECTION", selectionExpiresAt: stamped, deadline },
        after,
        14,
      ),
    ).toBe(stamped);
  });
});
