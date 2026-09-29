"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Bid } from "../domain/bid";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import { formatTenderMoney } from "../../tenders/ui/tender-format";
import { BidForm } from "./bid-form";
import { bidFormCopy } from "./bid-copy";
import { offerStatus } from "./offer-status";
import { withdrawBidRequest } from "./bid-request";

export function OwnOffer({
  bid,
  tenderId,
  currency,
  deadline,
  tenderStatus,
  canEdit,
  locale,
  messages,
  dates,
}: Readonly<{
  bid: Bid | null;
  tenderId: string;
  currency: "GEL" | "USD";
  deadline: Date | string;
  tenderStatus: string;
  canEdit: boolean;
  locale: Locale;
  messages: Messages;
  dates: Readonly<{
    submitted: string | null;
    updated: string | null;
    deadline: string | null;
    start: string | null;
  }>;
}>) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const router = useRouter();
  const c = messages.bidding.offer;
  const copy = bidFormCopy(messages);
  function closeEditor() {
    setEditing(false);
    requestAnimationFrame(() => heading.current?.focus());
  }
  async function withdraw() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/tenders/${tenderId}/bids/mine`,
        withdrawBidRequest,
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(copy.errorsByCode[body?.code] ?? copy.genericError);
        return;
      }
      setConfirming(false);
      setNotice(copy.withdrawn);
      router.refresh();
    } catch {
      setError(copy.genericError);
    } finally {
      setPending(false);
    }
  }
  const state = bid ? offerStatus(bid.status, tenderStatus, deadline) : null;
  const editable = canEdit && state === "active";
  const body =
    state === "won"
      ? messages.bidding.outcomeWonBody
      : state === "lost"
        ? messages.bidding.outcomeLostBody
        : state
          ? c[
              `${state}Body` as
                | "activeBody"
                | "pendingBody"
                | "withdrawnBody"
                | "cancelledBody"
                | "endedBody"
            ]
          : null;
  return (
    <section
      id="my-offer"
      className="own-offer"
      aria-labelledby="own-offer-title"
    >
      <div className="own-offer-heading">
        <h2 id="own-offer-title" ref={heading} tabIndex={-1}>
          {c.title}
        </h2>
        <Link href={`/${locale}/provider/offers`}>{c.back}</Link>
      </div>
      {notice ? (
        <p role="status" className="success-status">
          {notice}
        </p>
      ) : null}
      {state ? (
        <>
          <p className={`offer-status offer-status-${state}`}>
            {c.statuses[state]}
          </p>
          <p>{body}</p>
        </>
      ) : null}
      {bid === null || (editing && editable) ? (
        <BidForm
          key={bid?.updatedAt.toString() ?? "new"}
          copy={copy}
          existing={bid}
          tenderId={tenderId}
          currency={currency}
          onSaved={() => {
            setNotice(bid ? copy.revised : copy.submitted);
            closeEditor();
          }}
          onCancel={bid ? closeEditor : undefined}
        />
      ) : (
        <>
          <p className="own-offer-amount">
            {formatTenderMoney(bid.amountMinorUnits, bid.currency, locale)}
          </p>
          <dl className="own-offer-facts">
            {[
              [c.submittedAt, dates.submitted],
              [c.updatedAt, dates.updated],
              [c.deadline, dates.deadline],
              [copy.durationDays, bid.durationDays],
              [copy.proposedStartDate, dates.start],
              [copy.includedCosts, bid.includedCosts],
              [copy.exclusions, bid.exclusions],
              [copy.conditions, bid.conditions],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt>{label}</dt>
                <dd>{value ?? c.missing}</dd>
              </div>
            ))}
          </dl>
          {editable ? (
            <div className="own-offer-actions">
              <button
                type="button"
                className="tender-button"
                onClick={() => {
                  setEditing(true);
                  setConfirming(false);
                  setNotice(null);
                  requestAnimationFrame(() =>
                    document.getElementById("bid-amount")?.focus(),
                  );
                }}
              >
                {c.edit}
              </button>
              <button
                type="button"
                className="tender-button"
                onClick={() => setConfirming(true)}
              >
                {copy.withdraw}
              </button>
            </div>
          ) : null}
          {confirming && editable ? (
            <div
              className="own-offer-confirm"
              role="group"
              aria-label={c.confirmTitle}
            >
              <h3>{c.confirmTitle}</h3>
              <p>{c.confirmBody}</p>
              <div className="own-offer-actions">
                <button
                  className="tender-button"
                  disabled={pending}
                  onClick={withdraw}
                >
                  {pending ? copy.withdrawing : c.confirm}
                </button>
                <button
                  className="tender-button"
                  disabled={pending}
                  onClick={() => setConfirming(false)}
                >
                  {c.keep}
                </button>
              </div>
            </div>
          ) : null}
          {error ? <p role="alert">{error}</p> : null}
        </>
      )}
    </section>
  );
}
