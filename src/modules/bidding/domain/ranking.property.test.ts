import { describe, expect, it } from "vitest";
import type { BidTenderTerms, RankableBid } from "./bid";
import { rankBids, selectWinningBid } from "./ranking";

const terms: BidTenderTerms = {
  currency: "GEL",
  deadline: new Date("2026-07-01T09:00:00.000Z"),
};
const DEADLINE_MS = terms.deadline.getTime();

// A seeded LCG (Numerical Recipes constants). Deterministic, dependency-free,
// and good enough to shuffle and to draw amounts/timestamps from a small
// range — a small range is what makes ties, the interesting case, frequent.
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
    return state / 0x1_00_00_00_00;
  };
}

function generateBids(random: () => number, count: number): RankableBid[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `bid-${String(index).padStart(3, "0")}`,
    // Deliberately few distinct amounts and timestamps, so equal-amount and
    // equal-timestamp ties occur in most generated sets.
    amountMinorUnits: 1_000 * (1 + Math.floor(random() * 5)),
    currency: "GEL" as const,
    status: "SUBMITTED" as const,
    qualifyingSubmittedAt: new Date(
      DEADLINE_MS - 86_400_000 * (1 + Math.floor(random() * 4)),
    ),
  }));
}

function shuffle<T>(random: () => number, items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
  }
  return copy;
}

describe("rankBids ranks arbitrary valid bid sets deterministically", () => {
  it("produces the same order regardless of input order", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const random = createRandom(seed);
      const bids = generateBids(random, 1 + Math.floor(random() * 12));
      const expected = rankBids(bids, terms).map((bid) => bid.id);

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const reordered = rankBids(shuffle(random, bids), terms);
        expect(reordered.map((bid) => bid.id)).toEqual(expected);
      }
    }
  });

  it("never ranks a bid ahead of a strictly cheaper one", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const random = createRandom(seed);
      const ranked = rankBids(
        generateBids(random, 2 + Math.floor(random() * 12)),
        terms,
      );

      for (let index = 1; index < ranked.length; index += 1) {
        const previous = ranked[index - 1]!;
        const current = ranked[index]!;
        expect(previous.amountMinorUnits).toBeLessThanOrEqual(
          current.amountMinorUnits,
        );
        if (previous.amountMinorUnits === current.amountMinorUnits) {
          expect(previous.qualifyingSubmittedAt.getTime()).toBeLessThanOrEqual(
            current.qualifyingSubmittedAt.getTime(),
          );
          if (
            previous.qualifyingSubmittedAt.getTime() ===
            current.qualifyingSubmittedAt.getTime()
          ) {
            expect(previous.id < current.id).toBe(true);
          }
        }
      }
    }
  });

  it("always selects a bid that no other eligible bid beats", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const random = createRandom(seed);
      const bids = generateBids(random, 1 + Math.floor(random() * 12));
      const winner = selectWinningBid(bids, terms);
      expect(winner).not.toBeNull();

      for (const other of bids) {
        if (other.id === winner!.id) continue;
        const cheaper = other.amountMinorUnits < winner!.amountMinorUnits;
        const sameAmountButEarlier =
          other.amountMinorUnits === winner!.amountMinorUnits &&
          other.qualifyingSubmittedAt.getTime() <
            winner!.qualifyingSubmittedAt.getTime();
        expect(cheaper || sameAmountButEarlier).toBe(false);
      }
    }
  });
});
