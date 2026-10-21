import type { Clock, IdGenerator, Result } from "../../shared";
import type { BidActor } from "./submit-bid";

export type ChooseWinningBidError =
  | "INVALID_INPUT"
  | "TENDER_NOT_FOUND"
  | "NOT_OWNER"
  // The tender is not open for a choice: still a draft, cancelled, already
  // closed on another offer, expired, or past its selection window.
  | "TENDER_NOT_SELECTABLE"
  | "BID_NOT_FOUND"
  // The offer is withdrawn, already settled, or not eligible.
  | "BID_NOT_SELECTABLE";

export type ChooseWinningBidResult = Readonly<{
  tenderId: string;
  winningBidId: string;
  agreementId: string;
  // True when this exact offer had already been chosen: a double submit is
  // answered with the original result and no new side effects.
  alreadyChosen: boolean;
}>;

export type ChooseWinningBidCommand = Readonly<{
  tenderId: string;
  bidId: string;
  actorId: string;
  now: Date;
}>;

export interface ChooseWinningBidRepository {
  chooseWinner(
    command: ChooseWinningBidCommand,
    ids: IdGenerator,
  ): Promise<Result<ChooseWinningBidResult, ChooseWinningBidError>>;
}

// The client — and only the tender's owner — chooses the contractor. The
// platform never chooses one, and an administrator cannot either: the route
// requires the CUSTOMER capability and the repository re-checks ownership
// under the tender row lock.
export function createChooseWinningBid(dependencies: {
  repository: ChooseWinningBidRepository;
  clock: Clock;
  ids: IdGenerator;
}) {
  return async function chooseWinningBid(
    tenderId: string,
    bidId: unknown,
    actor: BidActor,
  ): Promise<Result<ChooseWinningBidResult, ChooseWinningBidError>> {
    if (typeof bidId !== "string" || bidId.length === 0 || bidId.length > 64) {
      return { ok: false, error: "INVALID_INPUT" };
    }
    return dependencies.repository.chooseWinner(
      {
        tenderId,
        bidId,
        actorId: actor.id,
        now: dependencies.clock.now(),
      },
      dependencies.ids,
    );
  };
}

export async function chooseWinningBid(
  tenderId: string,
  bidId: unknown,
  actor: BidActor,
  clock: Clock = { now: () => new Date() },
): Promise<Result<ChooseWinningBidResult, ChooseWinningBidError>> {
  const { prismaSelectionRepository } =
    await import("../infrastructure/prisma-selection-repository");
  return createChooseWinningBid({
    repository: prismaSelectionRepository,
    clock,
    ids: { next: () => crypto.randomUUID() },
  })(tenderId, bidId, actor);
}
