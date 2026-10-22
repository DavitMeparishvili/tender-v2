import Link from "next/link";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import {
  formatTenderDate,
  formatTenderMoney,
} from "../../tenders/ui/tender-format";
import { TenderIcon } from "../../tenders/ui/tender-icon";
import { VipBadge } from "../../vip/ui/vip-badge";
import type { ClientBidView } from "../application/list-tender-bids";
import type { BidStatus } from "../domain/bid";
import { bidFormCopy } from "./bid-copy";
import { ChooseBidButton, type ChooseBidCopy } from "./choose-bid-button";

export type BidComparisonCopy = Readonly<{
  title: string;
  empty: string;
  selectionRule: string;
  chooseBy: string;
  decision: string;
  lowestPrice: string;
  choose: ChooseBidCopy;
  provider: string;
  vipBadge: string;
  vipNeutrality: string;
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

// Keep client and contractor views consistent, with text as well as colour.
const STATUS_TAG_CLASS: Readonly<Record<BidStatus, string>> = {
  SUBMITTED: "offer-status-active",
  WINNER: "offer-status-won",
  LOST: "offer-status-lost",
  WITHDRAWN: "offer-status-withdrawn",
};

export function bidComparisonCopy(messages: Messages): BidComparisonCopy {
  return {
    title: messages.bidding.comparisonTitle,
    empty: messages.bidding.comparisonEmpty,
    // The comparison is only ever shown to the tender's owner.
    selectionRule: messages.bidding.selectionRuleOwner,
    chooseBy: messages.bidding.chooseBy,
    decision: messages.bidding.decision,
    lowestPrice: messages.bidding.lowestPrice,
    choose: {
      choose: messages.bidding.choose.action,
      confirmTitle: messages.bidding.choose.confirmTitle,
      confirmBody: messages.bidding.choose.confirmBody,
      confirm: messages.bidding.choose.confirm,
      keep: messages.bidding.choose.keep,
      choosing: messages.bidding.choose.choosing,
      errorsByCode: bidFormCopy(messages).errorsByCode,
      genericError: messages.errors.generic,
    },
    provider: messages.bidding.provider,
    vipBadge: messages.vip.badgeLabel,
    vipNeutrality: messages.vip.neutrality,
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

// The client compares the offers — VIP providers first, then from the lowest
// price — and chooses the contractor. A choose control appears only while `selection.open` is
// true and only on offers that can still be chosen; the server re-checks both
// under the tender lock. The "lowest price" tag is information, not a rule.
//
// One DOM structure, not two. The table reflows into labelled cards when its container is narrow
// through the `data-label` attributes below, rather than by rendering a second
// copy of every row — a duplicate would put each provider's name and amount on
// the page twice for screen readers and for tests.
export function BidComparison({
  bids,
  copy,
  locale,
  showSelectionRule = true,
  selection,
}: Readonly<{
  bids: readonly ClientBidView[];
  copy: BidComparisonCopy;
  locale: Locale;
  showSelectionRule?: boolean;
  // Present on the owner's page. `chooseBy` is the formatted end of the
  // selection window, shown once bidding has closed.
  selection?: Readonly<{
    tenderId: string;
    open: boolean;
    chooseBy: string | null;
  }>;
}>) {
  const canChoose = selection?.open === true;
  return (
    <section
      className="bid-comparison"
      aria-labelledby="bid-comparison-heading"
    >
      <h2 id="bid-comparison-heading">{copy.title}</h2>
      {showSelectionRule ? (
        <p className="tender-action-hint">{copy.selectionRule}</p>
      ) : null}
      {bids.some((bid) => bid.providerIsVip) ? (
        <p className="tender-action-hint bid-vip-disclosure">
          <TenderIcon name="info" size={14} />
          <span>{copy.vipNeutrality}</span>
        </p>
      ) : null}
      {canChoose && selection?.chooseBy ? (
        <p className="tender-action-hint bid-choose-by" role="note">
          {copy.chooseBy.replace("{date}", selection.chooseBy)}
        </p>
      ) : null}
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
                {canChoose ? <th scope="col">{copy.decision}</th> : null}
              </tr>
            </thead>
            <tbody>
              {bids.map((bid) => (
                <tr key={bid.id} data-bid-id={bid.id} data-status={bid.status}>
                  <th scope="row" data-label={copy.provider}>
                    <Link href={`/${locale}/profiles/${bid.providerId}`}>
                      {bid.providerDisplayName}
                    </Link>
                    {bid.providerIsVip ? (
                      <>
                        {" "}
                        <VipBadge label={copy.vipBadge} />
                      </>
                    ) : null}
                  </th>
                  <td data-label={copy.amount}>
                    {formatTenderMoney(
                      bid.amountMinorUnits,
                      bid.currency,
                      locale,
                    )}
                    {canChoose && bid.lowestPrice ? (
                      <>
                        {" "}
                        <span className="tag tag-emerald bid-lowest-tag">
                          {copy.lowestPrice}
                        </span>
                      </>
                    ) : null}
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
                    <span
                      className={`offer-status ${STATUS_TAG_CLASS[bid.status]}`}
                    >
                      {copy.statusLabels[bid.status]}
                    </span>
                  </td>
                  {canChoose && selection ? (
                    <td data-label={copy.decision}>
                      {bid.choosable ? (
                        <ChooseBidButton
                          bidId={bid.id}
                          copy={copy.choose}
                          providerName={bid.providerDisplayName}
                          tenderId={selection.tenderId}
                        />
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
