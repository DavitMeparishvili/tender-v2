"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import { formatTenderDate } from "../../tenders/ui/tender-format";
import type { InboxItem } from "../infrastructure/prisma-inbox-repository";

const knownMessages = {
  "notifications.agreementPartyConfirmed": "agreementPartyConfirmed",
  "notifications.agreementAgreed": "agreementAgreed",
  "notifications.agreementDeclined": "agreementDeclined",
  "notifications.agreementExpired": "agreementExpired",
  "notifications.workStartAcknowledged": "workStartAcknowledged",
  "notifications.workStarted": "workStarted",
  "notifications.completionConfirmed": "completionConfirmed",
  "notifications.agreementCompleted": "agreementCompleted",
  "notifications.agreementCancelled": "agreementCancelled",
  "notifications.tenderWinnerSelected": "tenderWinnerSelected",
  "notifications.bidWon": "bidWon",
  "notifications.bidLost": "bidLost",
  "notifications.tenderExpiredNoBids": "tenderExpiredNoBids",
  "notifications.tenderAwaitingSelection": "tenderAwaitingSelection",
  "notifications.tenderReopenedForSelection": "tenderReopenedForSelection",
  "notifications.tenderSelectionExpired": "tenderSelectionExpired",
  "notifications.tenderExpiredNoOffersLeft": "tenderExpiredNoOffersLeft",
  "notifications.tenderReopenedForBidding": "tenderReopenedForBidding",
  "notifications.reviewPublished": "reviewPublished",
  "notifications.reviewRedacted": "reviewRedacted",
} as const;

// Tender notifications addressed to the tender's owner open the client view;
// the rest are about a provider's own offer.
const CLIENT_TENDER_MESSAGES: ReadonlySet<string> = new Set([
  "notifications.tenderExpiredNoBids",
  "notifications.tenderWinnerSelected",
  "notifications.tenderAwaitingSelection",
  "notifications.tenderReopenedForSelection",
  "notifications.tenderSelectionExpired",
  "notifications.tenderExpiredNoOffersLeft",
  "notifications.tenderReopenedForBidding",
]);

function interpolate(template: string, variables: InboxItem["variables"]) {
  return template.replace(/\{([\w]+)\}/gu, (_, name: string) => {
    const value = variables[name];
    return value === null || value === undefined ? "" : String(value);
  });
}

function notificationText(item: InboxItem, messages: Messages) {
  const key = knownMessages[item.messageKey as keyof typeof knownMessages];
  return key
    ? interpolate(messages.notifications[key], item.variables)
    : messages.notifications.generic;
}

export function InboxList({
  items,
  locale,
  messages,
  userId,
}: Readonly<{
  items: readonly InboxItem[];
  locale: Locale;
  messages: Messages;
  userId: string;
}>) {
  const router = useRouter();
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function markRead(id: string) {
    setMarkingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ read: true }),
      });
      if (!response.ok) {
        setError(messages.errors.generic);
        return;
      }
      router.refresh();
    } catch {
      setError(messages.errors.generic);
    } finally {
      setMarkingId(null);
    }
  }

  if (items.length === 0) {
    return <p className="tender-empty">{messages.notifications.empty}</p>;
  }

  return (
    <>
      {error ? <p role="alert">{error}</p> : null}
      <ul className="tender-list">
        {items.map((item) => {
          const href =
            item.aggregateType === "Agreement"
              ? `/${locale}/agreements/${item.aggregateId}`
              : item.aggregateType === "Tender" &&
                  item.messageKey in knownMessages
                ? typeof item.variables.agreementId === "string"
                  ? `/${locale}/agreements/${encodeURIComponent(item.variables.agreementId)}`
                  : `/${locale}/${CLIENT_TENDER_MESSAGES.has(item.messageKey) ? "client" : "provider"}/tenders/${encodeURIComponent(item.aggregateId)}`
                : item.aggregateType === "Review"
                  ? `/${locale}/profiles/${userId}`
                  : null;
          const date = formatTenderDate(item.createdAt, locale);
          const isMarking = markingId === item.id;
          return (
            <li data-unread={item.readAt === null} key={item.id}>
              <p className="inbox-item-text">
                {notificationText(item, messages)}
              </p>
              <div className="inbox-item-meta">
                {/* Unread is a labelled tag, never weight or colour alone. */}
                {item.readAt === null ? (
                  <span className="tag tag-emerald">
                    {messages.notifications.unread}
                  </span>
                ) : (
                  <span className="tag tag-grey">
                    {messages.notifications.read}
                  </span>
                )}
                {date ? (
                  <time dateTime={item.createdAt.toISOString()}>{date}</time>
                ) : null}
              </div>
              <div className="inbox-item-actions">
                {href ? (
                  <Link className="pill pill-outline" href={href}>
                    {messages.notifications.open}
                  </Link>
                ) : null}
                {item.readAt === null ? (
                  <button
                    className="pill pill-outline"
                    type="button"
                    disabled={isMarking}
                    onClick={() => void markRead(item.id)}
                  >
                    {isMarking
                      ? messages.notifications.markingRead
                      : messages.notifications.markRead}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
