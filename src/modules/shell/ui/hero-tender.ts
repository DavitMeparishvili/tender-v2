import type { PublicTenderSummary } from "../../tenders/domain/masking";

/**
 * The hero preview is the newest open tender by publication time, across all
 * tenders. It is deliberately not the first row of the VIP-first list, so the
 * hero stays neutral. Ties break by id so the choice is stable.
 */
export function pickHeroTender(
  tenders: readonly PublicTenderSummary[],
): PublicTenderSummary | undefined {
  let best: PublicTenderSummary | undefined;
  for (const tender of tenders) {
    if (best === undefined) {
      best = tender;
      continue;
    }
    const delta = Date.parse(tender.publishedAt) - Date.parse(best.publishedAt);
    if (delta > 0 || (delta === 0 && tender.id < best.id)) best = tender;
  }
  return best;
}
