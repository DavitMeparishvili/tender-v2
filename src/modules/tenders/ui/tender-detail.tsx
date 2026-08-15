import Link from "next/link";
import type { ReactNode } from "react";
import type { TenderActor } from "../application/create-tender-draft";
import { getOwnedTender } from "../application/get-owned-tender";
import type { TenderDraft, TenderStatus } from "../domain/tender";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import { IdentityShell } from "../../identity/ui/identity-shell";
import { CancelTenderForm } from "./cancel-tender-form";
import { PublishTenderForm } from "./publish-tender-form";
import {
  formatTenderDate,
  formatTenderMoney,
  tenderStatusLabel,
} from "./tender-format";

type TenderDetailContentProps = Readonly<{
  cancelControl?: ReactNode;
  publishControl?: ReactNode;
  locale: Locale;
  messages: Messages;
  tender: TenderDraft;
}>;

function DetailRow({
  label,
  value,
}: Readonly<{ label: string; value: ReactNode }>) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function TenderDetailContent({
  cancelControl,
  publishControl,
  locale,
  messages,
  tender,
}: TenderDetailContentProps) {
  const fallback = messages.tenders.notProvided;
  const statusLabels: Readonly<Record<TenderStatus, string>> = {
    DRAFT: messages.tenders.statusDraft,
    PUBLISHED: messages.tenders.statusPublished,
    CANCELLED: messages.tenders.statusCancelled,
  };
  const location = tender.location;

  return (
    <>
      <div className="tender-detail-status" data-tender-status={tender.status}>
        <span aria-hidden="true" />
        {tenderStatusLabel(tender.status, statusLabels)}
      </div>
      <dl className="tender-detail">
        <DetailRow
          label={messages.tenders.filterSpecialty}
          value={messages.tenders.specialtyConstructionRepair}
        />
        <DetailRow label={messages.tenders.title} value={tender.title} />
        <DetailRow
          label={messages.tenders.shortDescription}
          value={tender.shortDescription ?? fallback}
        />
        <DetailRow
          label={messages.tenders.fullDescription}
          value={tender.fullDescription ?? fallback}
        />
        <DetailRow
          label={messages.tenders.scopeOfWork}
          value={tender.scopeOfWork ?? fallback}
        />
        <DetailRow
          label={messages.tenders.budget}
          value={
            formatTenderMoney(
              tender.budgetMinorUnits,
              tender.currency,
              locale,
            ) ?? fallback
          }
        />
        <DetailRow
          label={messages.tenders.deadline}
          value={formatTenderDate(tender.deadline, locale) ?? fallback}
        />
        <DetailRow
          label={messages.tenders.desiredStartDate}
          value={formatTenderDate(tender.desiredStartDate, locale) ?? fallback}
        />
        <DetailRow
          label={messages.tenders.workerNotes}
          value={tender.workerNotes ?? fallback}
        />
        <DetailRow
          label={messages.tenders.equipmentNotes}
          value={tender.equipmentNotes ?? fallback}
        />
        <DetailRow
          label={messages.tenders.materialNotes}
          value={tender.materialNotes ?? fallback}
        />
        <DetailRow
          label={messages.tenders.conditions}
          value={tender.conditions ?? fallback}
        />
        <DetailRow
          label={messages.tenders.city}
          value={location?.city ?? fallback}
        />
        <DetailRow
          label={messages.tenders.district}
          value={location?.district ?? fallback}
        />
        <DetailRow
          label={messages.tenders.addressLine}
          value={location?.addressLine ?? fallback}
        />
        <DetailRow
          label={messages.tenders.latitude}
          value={location?.exact.latitude ?? fallback}
        />
        <DetailRow
          label={messages.tenders.longitude}
          value={location?.exact.longitude ?? fallback}
        />
        <DetailRow
          label={messages.tenders.publishedAt}
          value={formatTenderDate(tender.publishedAt, locale) ?? fallback}
        />
        <DetailRow
          label={messages.tenders.cancelledAt}
          value={formatTenderDate(tender.cancelledAt, locale) ?? fallback}
        />
        <DetailRow
          label={messages.tenders.cancelReason}
          value={tender.cancelReason ?? fallback}
        />
        <DetailRow
          label={messages.tenders.createdAt}
          value={formatTenderDate(tender.createdAt, locale)}
        />
        <DetailRow
          label={messages.tenders.updatedAt}
          value={formatTenderDate(tender.updatedAt, locale)}
        />
      </dl>
      {tender.status === "DRAFT" && publishControl ? (
        <section className="tender-publish" aria-labelledby="publish-heading">
          <h2 id="publish-heading">{messages.tenders.publish}</h2>
          {publishControl}
        </section>
      ) : null}
      {tender.status !== "CANCELLED" && cancelControl ? (
        <section className="tender-cancel" aria-labelledby="cancel-heading">
          <h2 id="cancel-heading">{messages.tenders.cancel}</h2>
          {cancelControl}
        </section>
      ) : null}
    </>
  );
}

export async function TenderDetail({
  actor,
  id,
  locale,
  messages,
  tender,
}: Readonly<{
  actor: TenderActor;
  id: string;
  locale: Locale;
  messages: Messages;
  tender?: TenderDraft;
}>) {
  const owned = tender
    ? ({ ok: true, value: tender } as const)
    : await getOwnedTender(id, actor);
  if (!owned.ok) return null;

  return (
    <IdentityShell title={owned.value.title}>
      <Link className="back-link" href={`/${locale}/client/tenders`}>
        {messages.tenders.backToList}
      </Link>
      {owned.value.status === "DRAFT" ? (
        <div className="tender-draft-actions">
          <Link
            className="button button-secondary"
            href={`/${locale}/client/tenders/new?tenderId=${id}`}
          >
            {messages.tenders.editDraft}
          </Link>
        </div>
      ) : null}
      <TenderDetailContent
        locale={locale}
        messages={messages}
        tender={owned.value}
        publishControl={<PublishTenderForm tenderId={id} messages={messages} />}
        cancelControl={<CancelTenderForm tenderId={id} messages={messages} />}
      />
    </IdentityShell>
  );
}
