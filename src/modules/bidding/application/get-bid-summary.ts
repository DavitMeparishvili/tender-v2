import type { Result } from "../../shared";
import { summarizeBids } from "../domain/bid-summary";
import type { BidSummary } from "../domain/bid-summary";
import type { Bid, RankableBid } from "../domain/bid";
import type { BidActor, TenderContextLookup } from "./submit-bid";

export interface BidSummaryRepository {
  listRankableBids(tenderId: string): Promise<readonly RankableBid[]>;
  // Scoped to one provider's own bid. There is no read anywhere in this
  // module that hands one provider another provider's bid.
  findOwnBid(tenderId: string, providerId: string): Promise<Bid | null>;
}

export function createGetBidSummary(dependencies: {
  repository: BidSummaryRepository;
  tenders: TenderContextLookup;
}) {
  return async function getBidSummary(
    tenderId: string,
  ): Promise<Result<BidSummary, "TENDER_NOT_FOUND">> {
    const tender = await dependencies.tenders(tenderId);
    if (!tender.ok) return { ok: false, error: "TENDER_NOT_FOUND" };
    const bids = await dependencies.repository.listRankableBids(tenderId);
    // Summarised through the domain projection, so what a competitor sees is
    // the count and the current lowest amount — never who bid or when.
    return {
      ok: true,
      value: summarizeBids(bids, {
        currency: tender.value.currency,
        deadline: tender.value.deadline,
      }),
    };
  };
}

export async function getBidSummary(
  tenderId: string,
): Promise<Result<BidSummary, "TENDER_NOT_FOUND">> {
  const [{ prismaBidRepository }, { getTenderBiddingContext }] =
    await Promise.all([
      import("../infrastructure/prisma-bid-repository"),
      import("../../tenders/application/get-tender-bidding-context"),
    ]);
  return createGetBidSummary({
    repository: prismaBidRepository,
    tenders: getTenderBiddingContext,
  })(tenderId);
}

export function createGetOwnBid(dependencies: {
  repository: BidSummaryRepository;
  tenders: TenderContextLookup;
}) {
  return async function getOwnBid(
    tenderId: string,
    actor: BidActor,
  ): Promise<Result<Bid | null, "TENDER_NOT_FOUND">> {
    const tender = await dependencies.tenders(tenderId);
    if (!tender.ok) return { ok: false, error: "TENDER_NOT_FOUND" };
    return {
      ok: true,
      value: await dependencies.repository.findOwnBid(tenderId, actor.id),
    };
  };
}

// Feeds the provider detail page: which control to render (submit vs revise)
// and, after selection, whether this provider won or lost.
export async function getOwnBid(
  tenderId: string,
  actor: BidActor,
): Promise<Result<Bid | null, "TENDER_NOT_FOUND">> {
  const [{ prismaBidRepository }, { getTenderBiddingContext }] =
    await Promise.all([
      import("../infrastructure/prisma-bid-repository"),
      import("../../tenders/application/get-tender-bidding-context"),
    ]);
  return createGetOwnBid({
    repository: prismaBidRepository,
    tenders: getTenderBiddingContext,
  })(tenderId, actor);
}
