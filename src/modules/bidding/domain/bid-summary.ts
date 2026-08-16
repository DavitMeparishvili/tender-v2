import type { BidCurrency, BidTenderTerms, RankableBid } from "./bid";
import { rankBids } from "./ranking";

// Exactly what a competing provider may see (program design §4.3): how many
// eligible bids exist and what the current lowest amount is. Bidder identity,
// terms, and submission times are deliberately absent from the TYPE, so a
// careless spread at a call site cannot leak them.
export type BidSummary = Readonly<{
  bidCount: number;
  lowestAmountMinorUnits: number | null;
  currency: BidCurrency;
}>;

export function summarizeBids(
  bids: readonly RankableBid[],
  terms: BidTenderTerms,
): BidSummary {
  const ranked = rankBids(bids, terms);
  return {
    bidCount: ranked.length,
    lowestAmountMinorUnits: ranked[0]?.amountMinorUnits ?? null,
    currency: terms.currency,
  };
}
