import { z } from "zod";
import type { Clock, Result } from "../../shared";
import type { TenderDraft } from "../domain/tender";
import type { BidPresence } from "../ports/bid-presence";
import type { TenderActor } from "./create-tender-draft";
import type { TenderMutationError } from "./update-tender-draft";

export const cancelTenderCommandSchema = z
  .object({ reason: z.string().trim().min(5).max(500) })
  .strict();
export type CancelTenderCommand = z.output<typeof cancelTenderCommandSchema>;
// Cancellation is legal from DRAFT and PUBLISHED alike, so `NOT_DRAFT` is not
// part of this surface — only a second cancellation is refused.
export type CancelError =
  | Exclude<TenderMutationError, "NOT_DRAFT">
  | "ALREADY_CANCELLED"
  | "TENDER_HAS_BIDS";

export interface CancelTenderRepository {
  cancel(
    id: string,
    command: CancelTenderCommand,
    actor: TenderActor,
    now: Date,
  ): Promise<Result<TenderDraft, CancelError>>;
}

export function createCancelTender(dependencies: {
  repository: CancelTenderRepository;
  clock: Clock;
  hasBids: BidPresence;
}) {
  return async function cancelTender(
    id: string,
    input: unknown,
    actor: TenderActor,
  ): Promise<Result<TenderDraft, CancelError | "INVALID_INPUT">> {
    const parsed = cancelTenderCommandSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
    // Checked before the write rather than inside it, because the bid count
    // lives in another module's table: the guard has to be a published query,
    // not a `where` clause. The window this leaves is bounded by the same
    // deadline both sides respect, and a bid landing in it is protected by
    // the selection lock, which refuses to run for a CANCELLED tender.
    if (await dependencies.hasBids(id)) {
      return { ok: false, error: "TENDER_HAS_BIDS" };
    }
    return dependencies.repository.cancel(
      id,
      parsed.data,
      actor,
      dependencies.clock.now(),
    );
  };
}

const systemClock: Clock = { now: () => new Date() };

export async function cancelTender(
  id: string,
  input: unknown,
  actor: TenderActor,
): Promise<Result<TenderDraft, CancelError | "INVALID_INPUT">> {
  const [{ prismaTenderRepository }, { tenderHasActiveBids }] =
    await Promise.all([
      import("../infrastructure/prisma-tender-repository"),
      import("../../bidding/application/tender-has-active-bids"),
    ]);
  return createCancelTender({
    repository: prismaTenderRepository,
    clock: systemClock,
    hasBids: tenderHasActiveBids,
  })(id, input, actor);
}
