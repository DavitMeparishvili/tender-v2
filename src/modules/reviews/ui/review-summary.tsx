import type { Messages } from "../../localization/get-messages";
import type { ReviewAggregate } from "../domain/review";

export function Stars({ score }: Readonly<{ score: number }>) {
  const filled = Math.round(score);
  return (
    <span aria-hidden="true" className="stars">
      {"★".repeat(Math.min(5, Math.max(0, filled)))}
      {"☆".repeat(Math.max(0, 5 - filled))}
    </span>
  );
}

/**
 * A star string is a picture of a number, so it is always accompanied by the
 * number itself and, for assistive technology, by the full sentence — "4.8 out
 * of 5, 61 reviews" — rather than a row of unlabelled glyphs.
 */
export function ReviewSummary({
  aggregate,
  copy,
  histogram,
  profileCopy,
}: Readonly<{
  aggregate: ReviewAggregate;
  copy: Messages["reviews"];
  /** Count of reviews per whole-star bucket, index 0 = 1★. */
  histogram?: readonly number[];
  profileCopy?: Messages["providerProfile"];
}>) {
  if (aggregate.reviewCount === 0) {
    return (
      <div className="tender-empty">
        <p>{profileCopy?.noReviewsYet ?? copy.empty}</p>
      </div>
    );
  }

  const overall = aggregate.overall ?? 0;
  const dimensions = [
    "quality",
    "deadline",
    "communication",
    "agreedPrice",
  ] as const;
  const buckets = histogram ?? [];
  const largest = Math.max(1, ...buckets);
  const countLabel = copy.reviewCount.replace(
    "{count}",
    String(aggregate.reviewCount),
  );

  return (
    <div aria-label={copy.title} className="review-summary">
      <div>
        <p className="review-score">{overall.toFixed(1)}</p>
        <p className="review-score-stars">
          <Stars score={overall} />
        </p>
        <p className="review-score-count">
          {profileCopy?.jobBound.replace(
            "{count}",
            String(aggregate.reviewCount),
          ) ?? countLabel}
        </p>
        <p className="skip-link">
          {profileCopy?.ratingLabel
            .replace("{score}", overall.toFixed(1))
            .replace("{count}", String(aggregate.reviewCount)) ?? countLabel}
        </p>
      </div>

      {buckets.length === 0 ? null : (
        <dl className="histogram">
          {[5, 4, 3, 2, 1].map((star) => {
            const value = buckets[star - 1] ?? 0;
            return (
              <div key={star}>
                <dt>{`${star} ★`}</dt>
                <dd>
                  <span aria-hidden="true" className="histogram-track">
                    <span
                      style={{ inlineSize: `${(value / largest) * 100}%` }}
                    />
                  </span>
                  <span className="histogram-count">{value}</span>
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      <dl className="criteria-list">
        {dimensions.map((dimension) => (
          <div key={dimension}>
            <dt>{copy[dimension]}</dt>
            <dd>{aggregate[dimension]?.toFixed(1) ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
