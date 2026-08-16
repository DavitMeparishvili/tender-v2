import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import { formatTenderMoney } from "../../tenders/ui/tender-format";
import type { BidSummary } from "../domain/bid-summary";

// Renders exactly what `BidSummary` carries and nothing more. The type has no
// bidder identity, terms, or timestamps in it, and this view must not add any.
export function BidSummaryView({
  locale,
  messages,
  summary,
}: Readonly<{
  locale: Locale;
  messages: Messages;
  summary: BidSummary;
}>) {
  return (
    <section className="bid-summary" aria-labelledby="bid-summary-heading">
      <h2 id="bid-summary-heading">{messages.bidding.summaryTitle}</h2>
      {summary.bidCount === 0 ? (
        <p>{messages.bidding.noBidsYet}</p>
      ) : (
        <dl>
          <div>
            <dt>{messages.bidding.summaryTitle}</dt>
            <dd>
              {messages.bidding.bidCount.replace(
                "{count}",
                String(summary.bidCount),
              )}
            </dd>
          </div>
          <div>
            <dt>{messages.bidding.currentLowest}</dt>
            <dd>
              {formatTenderMoney(
                summary.lowestAmountMinorUnits,
                summary.currency,
                locale,
              )}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
