import type { Result } from "@/src/modules/shared/domain/result";

export type ReviewScores = Readonly<{
  quality: number;
  deadline: number;
  communication: number;
  agreedPrice: number;
}>;

export type ReviewDraft = Readonly<{
  quality: number;
  deadline: number;
  communication: number;
  agreedPrice: number;
  comment: string;
}>;

export type ValidatedReviewDraft = Readonly<{
  scores: ReviewScores;
  overall: number;
  comment: string;
}>;

export type ReviewValidationError =
  "INVALID_REVIEW" | "SCORE_OUT_OF_RANGE" | "COMMENT_NOT_SUBSTANTIVE";

export type PublishedReviewForAggregate = Readonly<{
  status: "PUBLISHED" | "REDACTED";
  scores: ReviewScores;
}>;

export type ReviewAggregate = Readonly<{
  reviewCount: number;
  overall: number | null;
  quality: number | null;
  deadline: number | null;
  communication: number | null;
  agreedPrice: number | null;
}>;

const draftKeys = new Set([
  "quality",
  "deadline",
  "communication",
  "agreedPrice",
  "comment",
]);

export function deriveOverallRating(scores: ReviewScores): number {
  return (
    (scores.quality +
      scores.deadline +
      scores.communication +
      scores.agreedPrice) /
    4
  );
}

export function normalizeReviewComment(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

function isSubstantive(comment: string): boolean {
  const characters = Array.from(comment);
  const words = comment.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return (
    characters.length >= 30 && words.length >= 5 && new Set(words).size >= 3
  );
}

function isExactDraft(value: unknown): value is ReviewDraft {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const entries = Object.entries(value);
  return (
    entries.length === draftKeys.size &&
    entries.every(([key]) => draftKeys.has(key))
  );
}

export function validateReviewDraft(
  value: unknown,
): Result<ValidatedReviewDraft, ReviewValidationError> {
  if (!isExactDraft(value) || typeof value.comment !== "string") {
    return { ok: false, error: "INVALID_REVIEW" };
  }
  const scores: ReviewScores = {
    quality: value.quality,
    deadline: value.deadline,
    communication: value.communication,
    agreedPrice: value.agreedPrice,
  };
  if (
    Object.values(scores).some(
      (score) => !Number.isInteger(score) || score < 1 || score > 5,
    )
  ) {
    return { ok: false, error: "SCORE_OUT_OF_RANGE" };
  }
  const comment = normalizeReviewComment(value.comment);
  if (!isSubstantive(comment))
    return { ok: false, error: "COMMENT_NOT_SUBSTANTIVE" };
  return {
    ok: true,
    value: { scores, overall: deriveOverallRating(scores), comment },
  };
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function aggregatePublishedReviews(
  reviews: readonly PublishedReviewForAggregate[],
): ReviewAggregate {
  const published = reviews.filter((review) => review.status === "PUBLISHED");
  if (published.length === 0) {
    return {
      reviewCount: 0,
      overall: null,
      quality: null,
      deadline: null,
      communication: null,
      agreedPrice: null,
    };
  }
  const sum = (key: keyof ReviewScores): number =>
    published.reduce((total, review) => total + review.scores[key], 0);
  const average = (key: keyof ReviewScores): number =>
    round(sum(key) / published.length);
  const quality = average("quality");
  const deadline = average("deadline");
  const communication = average("communication");
  const agreedPrice = average("agreedPrice");
  return {
    reviewCount: published.length,
    overall: round(
      published.reduce(
        (total, review) => total + deriveOverallRating(review.scores),
        0,
      ) / published.length,
    ),
    quality,
    deadline,
    communication,
    agreedPrice,
  };
}
