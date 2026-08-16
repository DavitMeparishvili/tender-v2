import type { Clock, IdGenerator, Result } from "../../shared";
import type {
  RedactReviewResult,
  ReviewModerationRepository,
} from "../infrastructure/prisma-review-repository";

export type RedactReviewError = "REVIEW_NOT_FOUND" | "INVALID_REDACTION_REASON";

function normalizeReason(value: string): string | null {
  const normalized = value.trim().replace(/\s+/gu, " ");
  const length = Array.from(normalized).length;
  return length >= 10 && length <= 500 ? normalized : null;
}

export function createRedactReview(
  dependencies: Readonly<{
    repository: ReviewModerationRepository;
    ids: IdGenerator;
    clock: Clock;
  }>,
) {
  return async function redactReview(
    reviewId: string,
    input: Readonly<{ reason: string }>,
    admin: Readonly<{ id: string }>,
  ): Promise<Result<RedactReviewResult, RedactReviewError>> {
    const reason = normalizeReason(input.reason);
    if (reason === null) {
      return { ok: false, error: "INVALID_REDACTION_REASON" };
    }
    return dependencies.repository.redact(
      reviewId,
      reason,
      admin.id,
      dependencies.ids,
      dependencies.clock.now(),
    );
  };
}

const systemIds: IdGenerator = { next: () => crypto.randomUUID() };
const systemClock: Clock = { now: () => new Date() };

export async function redactReview(
  reviewId: string,
  input: Readonly<{ reason: string }>,
  admin: Readonly<{ id: string }>,
) {
  const { prismaReviewRepository } =
    await import("../infrastructure/prisma-review-repository");
  return createRedactReview({
    repository: prismaReviewRepository,
    ids: systemIds,
    clock: systemClock,
  })(reviewId, input, admin);
}
