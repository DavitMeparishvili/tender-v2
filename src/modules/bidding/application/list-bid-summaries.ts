import { summarizeBids, type BidSummary } from "../domain/bid-summary";
import type { BidCurrency, RankableBid } from "../domain/bid";

export type SummarizedTender = Readonly<{
  id: string;
  currency: BidCurrency;
  deadline: Date;
}>;

export interface BidSummariesRepository {
  listRankableBidsForTenders(
    tenderIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly RankableBid[]>>;
}

/**
 * A list page needs the competition figure for every card it renders. Asking
 * per card turns one screen into two queries per row, so the rows are read
 * once and projected through the same domain summary a single tender uses —
 * count and current lowest only, never who bid.
 */
export function createListBidSummaries(dependencies: {
  repository: BidSummariesRepository;
}) {
  return async function listBidSummaries(
    tenders: readonly SummarizedTender[],
  ): Promise<ReadonlyMap<string, BidSummary>> {
    if (tenders.length === 0) return new Map();

    const byTender = await dependencies.repository.listRankableBidsForTenders(
      tenders.map((tender) => tender.id),
    );

    return new Map(
      tenders.map((tender) => [
        tender.id,
        summarizeBids(byTender.get(tender.id) ?? [], {
          currency: tender.currency,
          deadline: tender.deadline,
        }),
      ]),
    );
  };
}

export async function listBidSummaries(
  tenders: readonly SummarizedTender[],
): Promise<ReadonlyMap<string, BidSummary>> {
  const { prismaBidRepository } =
    await import("../infrastructure/prisma-bid-repository");
  return createListBidSummaries({ repository: prismaBidRepository })(tenders);
}
