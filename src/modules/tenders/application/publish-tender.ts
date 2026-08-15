import type { Clock, Result } from "../../shared";
import {
  evaluateDraftForPublication,
  type PublicationBlockingReason,
} from "../domain/publication-policy";
import type { TenderRecord } from "../domain/tender";
import type { TenderActor } from "./create-tender-draft";
import type { GetOwnedTenderRepository } from "./get-owned-tender";
import type { TenderMutationError } from "./update-tender-draft";

export type PublishError = TenderMutationError | PublicationBlockingReason;

export interface PublishTenderRepository extends GetOwnedTenderRepository {
  publish(
    id: string,
    actor: TenderActor,
    now: Date,
  ): Promise<Result<TenderRecord, TenderMutationError>>;
}

export function createPublishTender(dependencies: {
  repository: PublishTenderRepository;
  clock: Clock;
}) {
  return async function publishTender(
    id: string,
    actor: TenderActor,
  ): Promise<Result<TenderRecord, PublishError>> {
    const now = dependencies.clock.now();
    const draft = await dependencies.repository.getOwned(id, actor);
    if (!draft.ok) return draft;

    const evaluation = evaluateDraftForPublication(draft.value, now);
    if (!evaluation.ok) return { ok: false, error: evaluation.error };

    return dependencies.repository.publish(id, actor, now);
  };
}

const systemClock: Clock = { now: () => new Date() };

export async function publishTender(
  id: string,
  actor: TenderActor,
): Promise<Result<TenderRecord, PublishError>> {
  const { prismaTenderRepository } =
    await import("../infrastructure/prisma-tender-repository");
  return createPublishTender({
    repository: prismaTenderRepository,
    clock: systemClock,
  })(id, actor);
}
