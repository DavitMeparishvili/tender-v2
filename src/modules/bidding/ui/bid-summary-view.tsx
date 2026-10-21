import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import { formatTenderMoney } from "../../tenders/ui/tender-format";
import type { BidSummary } from "../domain/bid-summary";

// Renders exactly what `BidSummary` carries and nothing more. The type has no
// bidder identity, terms, or timestamps in it, and this view must not add any.
export function BidSummaryView({
  isOpen = true,
  reviewing = false,
  contractorChosen = false,
  locale,
  messages,
  summary,
}: Readonly<{
  isOpen?: boolean;
  // Bidding has closed and the client is choosing the contractor.
  reviewing?: boolean;
  // The client has chosen a contractor (an agreement is pending or agreed).
  contractorChosen?: boolean;
  locale: Locale;
  messages: Messages;
  summary: BidSummary;
}>) {
  const lowest = formatTenderMoney(
    summary.lowestAmountMinorUnits,
    summary.currency,
    locale,
  );

  return (
    <section aria-labelledby="bid-summary-heading" className="rail-card">
      <div className="rail-head">
        <h2 id="bid-summary-heading">{messages.bidding.summaryTitle}</h2>
        <span className={isOpen ? "tag tag-green" : "tag tag-grey"}>
          {isOpen
            ? messages.detail.competitionOpen
            : reviewing
              ? messages.detail.clientReviewing
              : contractorChosen
                ? messages.detail.contractorChosen
                : messages.detail.competitionClosed}
        </span>
      </div>

      {summary.bidCount === 0 || lowest === null ? (
        <>
          <p className="rail-headline">{messages.bidding.noBidsYet}</p>
          <p>{messages.detail.firstOfferNote}</p>
        </>
      ) : (
        <>
          <p className="rail-headline">{lowest}</p>
          <p>{messages.bidding.selectionRule}</p>
          <dl className="rail-figures">
            <div>
              <dt>{messages.detail.offersLabel}</dt>
              <dd>
                {messages.bidding.bidCount.replace(
                  "{count}",
                  String(summary.bidCount),
                )}
              </dd>
            </div>
            <div>
              <dt>{messages.bidding.currentLowest}</dt>
              <dd>{lowest}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}
