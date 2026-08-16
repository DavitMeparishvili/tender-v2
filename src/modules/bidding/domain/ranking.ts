import type { BidTenderTerms, RankableBid } from "./bid";
import { eligibleBids } from "./bid-eligibility";

// Amount ascending, then earliest qualifying submission, then stable id
// ascending. The third key exists so the order is total: without it two bids
// with identical amount and timestamp would rank by whatever order the
// database happened to return, and re-running selection could disagree with
// itself.
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

export function selectWinningBid(
  bids: readonly RankableBid[],
  terms: BidTenderTerms,
): RankableBid | null {
  return rankBids(bids, terms)[0] ?? null;
}
