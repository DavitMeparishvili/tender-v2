import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import {
  formatTenderDate,
  formatTenderMoney,
} from "../../tenders/ui/tender-format";
import type { PublicReviewView } from "../infrastructure/prisma-review-repository";
import { Stars } from "./review-summary";

function engagementValue(
  review: PublicReviewView,
  locale: Locale,
): string | null {
  return review.engagementCurrency === "GEL" ||
    review.engagementCurrency === "USD"
    ? formatTenderMoney(
        review.engagementAmountMinorUnits,
        review.engagementCurrency,
        locale,
      )
    : null;
}

export function ReviewList({
  reviews,
  locale,
  copy,
  profileCopy,
}: Readonly<{
  reviews: readonly PublicReviewView[];
  locale: Locale;
  copy: Messages["reviews"];
  profileCopy?: Messages["providerProfile"];
}>) {
  if (reviews.length === 0) {
    return (
      <div className="tender-empty">
        <p>{profileCopy?.noReviewsYet ?? copy.empty}</p>
      </div>
    );
  }

  return (
    <ul className="review-list">
      {reviews.map((review) => {
        const value = engagementValue(review, locale);
        return (
          <li
            className="review-item"
            key={`${review.reviewerDisplayName}-${review.publishedAt.toISOString()}`}
          >
            <div className="review-item-main">
              <div className="review-item-head">
                <Stars score={review.overall} />
                <span className="review-item-score">
                  {review.overall.toFixed(1)}
                </span>
                {profileCopy ? (
                  <span className="tag tag-green">
                    {profileCopy.verifiedCompletion}
                  </span>
                ) : null}
                <span className="skip-link">
                  {copy.overall}: {review.overall.toFixed(2)}
                </span>
              </div>
              <h3 className="review-item-title">{review.tenderTitle}</h3>
              <p className="review-item-quote">{review.comment}</p>
              <p className="review-item-attrib">
                {review.reviewerDisplayName} ·{" "}
                <time dateTime={review.publishedAt.toISOString()}>
                  {formatTenderDate(review.publishedAt, locale)}
                </time>
              </p>
            </div>
            {value === null ? null : (
              <dl className="review-item-value">
                <dt className="figure-label">{copy.agreedPrice}</dt>
                <dd>{value}</dd>
              </dl>
            )}
          </li>
        );
      })}
    </ul>
  );
}
