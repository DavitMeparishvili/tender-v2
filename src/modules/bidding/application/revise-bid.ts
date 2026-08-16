import type { Clock, Result } from "../../shared";
import type { Bid } from "../domain/bid";
import {
  submitBidCommandSchema,
  type BidActor,
  type SubmitBidCommand,
  type TenderContextLookup,
} from "./submit-bid";

export type ReviseBidError =
  | "INVALID_INPUT"
  | "TENDER_NOT_FOUND"
  | "BID_NOT_FOUND"
  | "BID_NOT_ACTIVE"
  | "DEADLINE_PASSED";

export interface ReviseBidRepository {
  reviseOwnBid(
    tenderId: string,
    providerId: string,
    command: SubmitBidCommand,
    qualifyingSubmittedAt: Date,
    deadline: Date,
  ): Promise<
    Result<Bid, "BID_NOT_FOUND" | "BID_NOT_ACTIVE" | "DEADLINE_PASSED">
  >;
}

export function createReviseBid(dependencies: {
  repository: ReviseBidRepository;
  tenders: TenderContextLookup;
  clock: Clock;
}) {
  return async function reviseBid(
    tenderId: string,
    input: unknown,
    actor: BidActor,
  ): Promise<Result<Bid, ReviseBidError>> {
    // A revision re-states the whole offer rather than patching it: a partial
    // patch would leave the surviving fields describing an offer the provider
    // never re-affirmed at the new price.
    const parsed = submitBidCommandSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

    const tender = await dependencies.tenders(tenderId);
    if (!tender.ok) return { ok: false, error: "TENDER_NOT_FOUND" };

    const now = dependencies.clock.now();
    if (now.getTime() >= tender.value.deadline.getTime()) {
      return { ok: false, error: "DEADLINE_PASSED" };
    }

    // The new timestamp is the point of a revision: a revised bid rejoins the
    // tie-break queue at the back (program design §4.3).
    return dependencies.repository.reviseOwnBid(
      tenderId,
      actor.id,
      parsed.data,
      now,
      tender.value.deadline,
    );
  };
}

export async function reviseBid(
  tenderId: string,
  input: unknown,
  actor: BidActor,
): Promise<Result<Bid, ReviseBidError>> {
  const [{ prismaBidRepository }, { getTenderBiddingContext }] =
    await Promise.all([
      import("../infrastructure/prisma-bid-repository"),
      import("../../tenders/application/get-tender-bidding-context"),
    ]);
  return createReviseBid({
    repository: prismaBidRepository,
    tenders: getTenderBiddingContext,
    clock: { now: () => new Date() },
  })(tenderId, input, actor);
}
