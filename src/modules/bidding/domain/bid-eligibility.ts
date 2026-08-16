import type { BidTenderTerms, RankableBid } from "./bid";

export type BidIneligibilityReason =
  | "WITHDRAWN"
  | "CURRENCY_MISMATCH"
  | "NON_POSITIVE_AMOUNT"
  | "SUBMITTED_AFTER_DEADLINE";

// Returns the FIRST reason a bid cannot be ranked, or null when it can. A
// reason (rather than a boolean) is what lets the selector explain an
// expired-without-bids outcome in its audit entry.
export function bidIneligibility(
  bid: RankableBid,
  terms: BidTenderTerms,
): BidIneligibilityReason | null {
  if (bid.status === "WITHDRAWN") return "WITHDRAWN";
  // All bids settle in the tender's currency; a mismatch would compare two
  // different units of account on the same integer.
  if (bid.currency !== terms.currency) return "CURRENCY_MISMATCH";
  if (
    !Number.isSafeInteger(bid.amountMinorUnits) ||
    bid.amountMinorUnits <= 0
  ) {
    return "NON_POSITIVE_AMOUNT";
  }
  // `>=`: the deadline instant is the first instant bidding is closed, so a
  // bid stamped exactly at the deadline did not make it.
  if (bid.qualifyingSubmittedAt.getTime() >= terms.deadline.getTime()) {
    return "SUBMITTED_AFTER_DEADLINE";
  }
  return null;
}

export function eligibleBids(
  bids: readonly RankableBid[],
  terms: BidTenderTerms,
): readonly RankableBid[] {
  return bids.filter((bid) => bidIneligibility(bid, terms) === null);
}
