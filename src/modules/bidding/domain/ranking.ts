import type { BidTenderTerms, RankableBid } from "./bid";
import { eligibleBids } from "./bid-eligibility";

// Amount ascending, then earliest qualifying submission, then stable id
// ascending. This is DISPLAY order only: the client compares offers from the
// lowest price and chooses the contractor; nothing picks a winner from it.
// The third key exists so the order is total: without it two bids with
// identical amount and timestamp would list in whatever order the database
// happened to return, and the comparison could reorder between page loads.
function compareBids(left: RankableBid, right: RankableBid): number {
  if (left.amountMinorUnits !== right.amountMinorUnits) {
    return left.amountMinorUnits - right.amountMinorUnits;
  }
  const leftTime = left.qualifyingSubmittedAt.getTime();
  const rightTime = right.qualifyingSubmittedAt.getTime();
  if (leftTime !== rightTime) return leftTime - rightTime;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

export function rankBids(
  bids: readonly RankableBid[],
  terms: BidTenderTerms,
): readonly RankableBid[] {
  // Copy before sorting: `Array.prototype.sort` mutates, and the caller's
  // array is frequently the repository's own result.
  return [...eligibleBids(bids, terms)].sort(compareBids);
}
