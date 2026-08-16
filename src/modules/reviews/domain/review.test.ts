import { describe, expect, it } from "vitest";
import {
  aggregatePublishedReviews,
  validateReviewDraft,
  type ReviewDraft,
} from "./review";

function validDraft(overrides: Partial<ReviewDraft> = {}): ReviewDraft {
  return {
    quality: 4,
    deadline: 4,
    communication: 4,
    agreedPrice: 4,
    comment: "Careful work, clear updates, and the agreed price was kept.",
    ...overrides,
  };
}

describe("validateReviewDraft", () => {
  it("normalizes a substantive review and derives, rather than accepts, overall", () => {
    expect(
      validateReviewDraft(
        validDraft({ quality: 5, deadline: 4, communication: 3 }),
      ),
    ).toEqual({
      ok: true,
      value: {
        scores: { quality: 5, deadline: 4, communication: 3, agreedPrice: 4 },
        overall: 4,
        comment: "Careful work, clear updates, and the agreed price was kept.",
      },
    });
  });

  it.each([
    [0, "SCORE_OUT_OF_RANGE"],
    [6, "SCORE_OUT_OF_RANGE"],
    [4.5, "SCORE_OUT_OF_RANGE"],
  ] as const)("rejects invalid quality score %s", (quality, error) => {
    expect(validateReviewDraft(validDraft({ quality }))).toEqual({
      ok: false,
      error,
    });
  });

  it("rejects a long repeated-word comment as non-substantive", () => {
    expect(
      validateReviewDraft(
        validDraft({ comment: "good good good good good good good good" }),
      ),
    ).toEqual({
      ok: false,
      error: "COMMENT_NOT_SUBSTANTIVE",
    });
  });
});

describe("aggregatePublishedReviews", () => {
  it("excludes redacted reviews and returns null averages for none", () => {
    expect(aggregatePublishedReviews([])).toEqual({
      reviewCount: 0,
      overall: null,
      quality: null,
      deadline: null,
      communication: null,
      agreedPrice: null,
    });
    expect(
      aggregatePublishedReviews([
        {
          status: "PUBLISHED",
          scores: { quality: 5, deadline: 4, communication: 3, agreedPrice: 4 },
        },
        {
          status: "REDACTED",
          scores: { quality: 1, deadline: 1, communication: 1, agreedPrice: 1 },
        },
      ]),
    ).toEqual({
      reviewCount: 1,
      overall: 4,
      quality: 5,
      deadline: 4,
      communication: 3,
      agreedPrice: 4,
    });
  });

  it("rounds the raw overall average only once", () => {
    expect(
      aggregatePublishedReviews([
        {
          status: "PUBLISHED",
          scores: { quality: 1, deadline: 1, communication: 1, agreedPrice: 1 },
        },
        {
          status: "PUBLISHED",
          scores: { quality: 1, deadline: 1, communication: 2, agreedPrice: 2 },
        },
        {
          status: "PUBLISHED",
          scores: { quality: 1, deadline: 1, communication: 2, agreedPrice: 2 },
        },
      ]),
    ).toMatchObject({ overall: 1.33 });
  });
});
