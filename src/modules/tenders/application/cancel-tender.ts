import { z } from "zod";
import type { Clock, Result } from "../../shared";
import type { TenderDraft } from "../domain/tender";
import type { TenderActor } from "./create-tender-draft";
import type { TenderMutationError } from "./update-tender-draft";

export const cancelTenderCommandSchema = z
  .object({ reason: z.string().trim().min(5).max(500) })
  .strict();
export type CancelTenderCommand = z.output<typeof cancelTenderCommandSchema>;
// Cancellation is legal from DRAFT and PUBLISHED alike, so `NOT_DRAFT` is not
// part of this surface — only a second cancellation is refused.
export type CancelError =
  Exclude<TenderMutationError, "NOT_DRAFT"> | "ALREADY_CANCELLED";

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
}) {
  return async function cancelTender(
    id: string,
    input: unknown,
    actor: TenderActor,
  ): Promise<Result<TenderDraft, CancelError | "INVALID_INPUT">> {
    const parsed = cancelTenderCommandSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
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
  const { prismaTenderRepository } =
    await import("../infrastructure/prisma-tender-repository");
  return createCancelTender({
    repository: prismaTenderRepository,
    clock: systemClock,
  })(id, input, actor);
}
