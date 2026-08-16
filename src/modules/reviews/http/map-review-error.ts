import type { PublishReviewError } from "../application/publish-review";

export function reviewErrorStatus(error: PublishReviewError): number {
  return {
    AGREEMENT_NOT_FOUND: 404,
    NOT_PARTICIPANT: 403,
    AGREEMENT_NOT_COMPLETED: 409,
    REVIEW_ALREADY_EXISTS: 409,
    INVALID_REVIEW: 422,
  }[error];
}
