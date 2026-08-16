import Link from "next/link";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import {
  formatTenderDate,
  formatTenderMoney,
} from "../../tenders/ui/tender-format";
import type { ClientBidView } from "../application/list-tender-bids";
import type { BidStatus } from "../domain/bid";

export type BidComparisonCopy = Readonly<{
  title: string;
  empty: string;
  automaticWinner: string;
  provider: string;
  amount: string;
  durationDays: string;
  includedCosts: string;
  exclusions: string;
  conditions: string;
  submittedAt: string;
  status: string;
  notProvided: string;
  statusLabels: Readonly<Record<BidStatus, string>>;
}>;

// Green is reserved for the winning offer; every other status shares the
// same neutral tag so the win is the one thing colour calls out.
const STATUS_TAG_CLASS: Readonly<Record<BidStatus, string>> = {
  SUBMITTED: "tag-grey",
  WINNER: "tag-green",
  LOST: "tag-grey",
  WITHDRAWN: "tag-grey",
};

export function bidComparisonCopy(messages: Messages): BidComparisonCopy {
  return {
    title: messages.bidding.comparisonTitle,
    empty: messages.bidding.comparisonEmpty,
    automaticWinner: messages.bidding.automaticWinner,
    provider: messages.bidding.provider,
    amount: messages.bidding.amount,
    durationDays: messages.bidding.durationDays,
    includedCosts: messages.bidding.includedCosts,
    exclusions: messages.bidding.exclusions,
    conditions: messages.bidding.conditions,
    submittedAt: messages.bidding.submittedAt,
    status: messages.bidding.status,
    notProvided: messages.tenders.notProvided,
    statusLabels: {
      SUBMITTED: messages.bidding.statusSubmitted,
      WINNER: messages.bidding.statusWinner,
      LOST: messages.bidding.statusLost,
      WITHDRAWN: messages.bidding.statusWithdrawn,
    },
  };
}

// A server component with no control that could select a winner. The client
// may compare offers and may not choose one, and the surest way to guarantee
// that is for this view to contain no button or form. The provider name does
// link out to that provider's public profile, but a read-only navigation link
// is not a selection control.
//
// One DOM structure, not two. The table reflows into labelled cards at 608px
// through the `data-label` attributes below, rather than by rendering a second
// copy of every row — a duplicate would put each provider's name and amount on
// the page twice for screen readers and for tests.
export function BidComparison({
  bids,
  copy,
  locale,
}: Readonly<{
  bids: readonly ClientBidView[];
  copy: BidComparisonCopy;
  locale: Locale;
}>) {
  return (
    <section
      className="bid-comparison"
      aria-labelledby="bid-comparison-heading"
    >
      <h2 id="bid-comparison-heading">{copy.title}</h2>
      <p className="tender-action-hint">{copy.automaticWinner}</p>
      {bids.length === 0 ? (
        <p>{copy.empty}</p>
      ) : (
        <div className="bid-comparison-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{copy.provider}</th>
                <th scope="col">{copy.amount}</th>
                <th scope="col">{copy.durationDays}</th>
                <th scope="col">{copy.includedCosts}</th>
                <th scope="col">{copy.exclusions}</th>
                <th scope="col">{copy.conditions}</th>
                <th scope="col">{copy.submittedAt}</th>
                <th scope="col">{copy.status}</th>
              </tr>
            </thead>
            <tbody>
              {bids.map((bid) => (
                <tr key={bid.id} data-status={bid.status}>
                  <th scope="row" data-label={copy.provider}>
                    <Link href={`/${locale}/profiles/${bid.providerId}`}>
                      {bid.providerDisplayName}
                    </Link>
                  </th>
                  <td data-label={copy.amount}>
                    {formatTenderMoney(
                      bid.amountMinorUnits,
                      bid.currency,
                      locale,
                    )}
                  </td>
                  <td data-label={copy.durationDays}>
                    {bid.durationDays ?? copy.notProvided}
                  </td>
                  <td data-label={copy.includedCosts}>
                    {bid.includedCosts ?? copy.notProvided}
                  </td>
                  <td data-label={copy.exclusions}>
                    {bid.exclusions ?? copy.notProvided}
                  </td>
                  <td data-label={copy.conditions}>{bid.conditions}</td>
                  <td data-label={copy.submittedAt}>
                    {formatTenderDate(bid.qualifyingSubmittedAt, locale) ??
                      copy.notProvided}
                  </td>
                  <td data-label={copy.status}>
                    {/* Status is a labelled tag, never colour alone. */}
                    <span className={`tag ${STATUS_TAG_CLASS[bid.status]}`}>
                      {copy.statusLabels[bid.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
