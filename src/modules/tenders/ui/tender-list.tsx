import Link from "next/link";
import type { ReactNode } from "react";
import type { TenderActor } from "../application/create-tender-draft";
import { listOwnedTenders } from "../application/list-owned-tenders";
import type { TenderDraft, TenderStatus } from "../domain/tender";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import { IdentityShell } from "../../identity/ui/identity-shell";
import {
  formatTenderDate,
  formatTenderMoney,
  tenderStatusLabel,
} from "./tender-format";

type TenderListContentProps = Readonly<{
  locale: Locale;
  messages: Messages;
  tenders: readonly TenderDraft[];
}>;

function displayValue(value: ReactNode, fallback: string) {
  return value ?? fallback;
}

export function TenderListContent({
  locale,
  messages,
  tenders,
}: TenderListContentProps) {
  const statusLabels: Readonly<Record<TenderStatus, string>> = {
    DRAFT: messages.tenders.statusDraft,
    PUBLISHED: messages.tenders.statusPublished,
    CANCELLED: messages.tenders.statusCancelled,
  };

  if (tenders.length === 0) {
    return (
      <section
        className="tender-empty"
        aria-label={messages.tenders.clientListEmpty}
      >
        <p>{messages.tenders.clientListEmpty}</p>
      </section>
    );
  }

  return (
    <ul className="tender-list">
      {tenders.map((tender) => {
        const href = `/${locale}/client/tenders/${tender.id}`;
        const deadline = formatTenderDate(tender.deadline, locale);
        const budget = formatTenderMoney(
          tender.budgetMinorUnits,
          tender.currency,
          locale,
        );

        return (
          <li key={tender.id} data-tender-status={tender.status}>
            <div className="tender-list-heading">
              <h2>
                <Link href={href}>{tender.title}</Link>
              </h2>
              <span className="tender-status">
                {tenderStatusLabel(tender.status, statusLabels)}
              </span>
            </div>
            <dl className="tender-list-facts">
              <div>
                <dt>{messages.tenders.deadline}</dt>
                <dd>{displayValue(deadline, messages.tenders.notProvided)}</dd>
              </div>
              <div>
                <dt>{messages.tenders.budget}</dt>
                <dd>{displayValue(budget, messages.tenders.notProvided)}</dd>
              </div>
            </dl>
            <div className="tender-row-actions">
              <Link href={href}>{messages.tenders.viewDetail}</Link>
              {tender.status === "DRAFT" ? (
                <>
                  <Link
                    href={`/${locale}/client/tenders/new?tenderId=${tender.id}`}
                  >
                    {messages.tenders.editDraft}
                  </Link>
                  <Link href={`${href}#publish-heading`}>
                    {messages.tenders.publish}
                  </Link>
                </>
              ) : null}
              {tender.status !== "CANCELLED" ? (
                <Link href={`${href}#cancel-heading`}>
                  {messages.tenders.cancel}
                </Link>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export async function TenderList({
  actor,
  locale,
  messages,
}: Readonly<{
  actor: TenderActor;
  locale: Locale;
  messages: Messages;
}>) {
  const tenders = await listOwnedTenders(actor);

  return (
    <IdentityShell title={messages.tenders.clientListTitle}>
      <div className="tender-primary-action">
        <Link
          className="button button-primary"
          href={`/${locale}/client/tenders/new`}
        >
          {messages.tenders.newTender}
        </Link>
      </div>
      <TenderListContent
        locale={locale}
        messages={messages}
        tenders={tenders}
      />
    </IdentityShell>
  );
}
