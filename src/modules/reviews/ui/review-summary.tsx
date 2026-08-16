import type { Messages } from "../../localization/get-messages";
import type { ReviewAggregate } from "../domain/review";

export function ReviewSummary({
  aggregate,
  copy,
}: Readonly<{ aggregate: ReviewAggregate; copy: Messages["reviews"] }>) {
  if (aggregate.reviewCount === 0)
    return <p className="tender-empty">{copy.empty}</p>;
  const dimensions = [
    "quality",
    "deadline",
    "communication",
    "agreedPrice",
  ] as const;
  return (
    <section className="review-summary" aria-label={copy.title}>
      <p>
        {copy.overall}: {aggregate.overall?.toFixed(2)}
      </p>
      <p>
        {copy.reviewCount.replace("{count}", String(aggregate.reviewCount))}
      </p>
      <dl>
        {dimensions.map((dimension) => (
          <div key={dimension}>
            <dt>{copy[dimension]}</dt>
            <dd>{aggregate[dimension]?.toFixed(2)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
