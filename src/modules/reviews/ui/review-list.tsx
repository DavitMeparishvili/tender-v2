import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import { formatTenderDate } from "../../tenders/ui/tender-format";
import type { PublicReviewView } from "../infrastructure/prisma-review-repository";

export function ReviewList({
  reviews,
  locale,
  copy,
}: Readonly<{
  reviews: readonly PublicReviewView[];
  locale: Locale;
  copy: Messages["reviews"];
}>) {
  if (reviews.length === 0) return <p className="tender-empty">{copy.empty}</p>;
  return (
    <ul className="tender-list">
      {reviews.map((review) => (
        <li
          key={`${review.reviewerDisplayName}-${review.publishedAt.toISOString()}`}
        >
          <h2>{review.tenderTitle}</h2>
          <p>{review.reviewerDisplayName}</p>
          <p>
            {copy.overall}: {review.overall.toFixed(2)}
          </p>
          <p>{review.comment}</p>
          <time dateTime={review.publishedAt.toISOString()}>
            {formatTenderDate(review.publishedAt, locale)}
          </time>
        </li>
      ))}
    </ul>
  );
}
