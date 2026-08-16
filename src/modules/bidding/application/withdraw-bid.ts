import type { Clock, Result } from "../../shared";
import type { Bid } from "../domain/bid";
import type { BidActor, TenderContextLookup } from "./submit-bid";

export type WithdrawBidError =
  "TENDER_NOT_FOUND" | "BID_NOT_FOUND" | "BID_NOT_ACTIVE" | "DEADLINE_PASSED";

export interface WithdrawBidRepository {
  withdrawOwnBid(
    tenderId: string,
    providerId: string,
    withdrawnAt: Date,
    deadline: Date,
  ): Promise<
    Result<Bid, "BID_NOT_FOUND" | "BID_NOT_ACTIVE" | "DEADLINE_PASSED">
  >;
}

export function createWithdrawBid(dependencies: {
  repository: WithdrawBidRepository;
  tenders: TenderContextLookup;
  clock: Clock;
}) {
  return async function withdrawBid(
    tenderId: string,
    actor: BidActor,
  ): Promise<Result<Bid, WithdrawBidError>> {
    const tender = await dependencies.tenders(tenderId);
    if (!tender.ok) return { ok: false, error: "TENDER_NOT_FOUND" };

    const now = dependencies.clock.now();
    if (now.getTime() >= tender.value.deadline.getTime()) {
      return { ok: false, error: "DEADLINE_PASSED" };
    }

    // The row is kept and flagged WITHDRAWN rather than deleted: the unique
    // (tenderId, providerId) constraint then also stops a withdrawn bidder
    // from opening a second record, and the audit trail survives.
    return dependencies.repository.withdrawOwnBid(
      tenderId,
      actor.id,
      now,
      tender.value.deadline,
    );
  };
}

export async function withdrawBid(
  tenderId: string,
  actor: BidActor,
): Promise<Result<Bid, WithdrawBidError>> {
  const [{ prismaBidRepository }, { getTenderBiddingContext }] =
    await Promise.all([
      import("../infrastructure/prisma-bid-repository"),
      import("../../tenders/application/get-tender-bidding-context"),
    ]);
  return createWithdrawBid({
    repository: prismaBidRepository,
    tenders: getTenderBiddingContext,
    clock: { now: () => new Date() },
  })(tenderId, actor);
}
