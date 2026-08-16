import type { Clock, IdGenerator, Result } from "../../shared";
import {
  validateReviewDraft,
} from "../domain/review";
import type {
  ReviewRepository,
  ReviewView,
} from "../infrastructure/prisma-review-repository";

export type PublishReviewError =
  | "AGREEMENT_NOT_FOUND"
  | "NOT_PARTICIPANT"
  | "AGREEMENT_NOT_COMPLETED"
  | "REVIEW_ALREADY_EXISTS"
  | "INVALID_REVIEW";

export function createPublishReview(
  dependencies: Readonly<{
    repository: ReviewRepository;
    ids: IdGenerator;
    clock: Clock;
  }>,
) {
  return async function publishReview(
    agreementId: string,
    input: unknown,
    actor: Readonly<{ id: string }>,
  ): Promise<Result<ReviewView, PublishReviewError>> {
    const draft = validateReviewDraft(input);
    if (!draft.ok) return { ok: false, error: "INVALID_REVIEW" };
    return dependencies.repository.publish(
      agreementId,
      actor.id,
      draft.value,
      dependencies.ids,
      dependencies.clock.now(),
    );
  };
}

const systemIds: IdGenerator = { next: () => crypto.randomUUID() };
const systemClock: Clock = { now: () => new Date() };

export async function publishReview(
  agreementId: string,
  input: unknown,
  actor: Readonly<{ id: string }>,
) {
  const { prismaReviewRepository } =
    await import("../infrastructure/prisma-review-repository");
  return createPublishReview({
    repository: prismaReviewRepository,
    ids: systemIds,
    clock: systemClock,
  })(agreementId, input, actor);
}
