import Link from "next/link";
import type { ReactNode } from "react";
import type { TenderActor } from "../application/create-tender-draft";
import {
  RENDERED_LINK_DOWNLOAD_URL_TTL_SECONDS,
  getAttachmentDownload,
} from "../application/get-attachment-download";
import { getOwnedTender } from "../application/get-owned-tender";
import { listTenderAttachments } from "../application/list-tender-attachments";
import type { TenderDraft, TenderStatus } from "../domain/tender";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import { IdentityShell } from "../../identity/ui/identity-shell";
import { CancelTenderForm } from "./cancel-tender-form";
import { LocationMap } from "./location-map";
import { PublishTenderForm } from "./publish-tender-form";
import {
  cancelTenderCopy,
  locationMapCopy,
  publishTenderCopy,
} from "./tender-action-copy";
import {
  formatAttachmentSize,
  formatTenderDate,
  formatTenderMoney,
  tenderStatusLabel,
} from "./tender-format";
import { serviceLabel, specialtyLabel } from "./tender-taxonomy";

// The signed URL is resolved on the server for each attachment, so this view
// carries a ready-to-use link and never exposes the underlying object key.
export type TenderAttachmentView = Readonly<{
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}>;

type TenderDetailContentProps = Readonly<{
  attachments?: readonly TenderAttachmentView[];
  cancelControl?: ReactNode;
  // True once a provider has placed an active bid. A cancel command that
  // reaches the server at this point is refused with `TENDER_HAS_BIDS`
  // (program design §4.2); this only stops the UI offering a control that
  // must fail — the server-side rejection is what enforces the rule.
  hasBids?: boolean;
  publishControl?: ReactNode;
  // The bid comparison (and, once settled, the outcome heading) for this
  // tender. Opaque `ReactNode` on purpose: this module renders bid data
  // without knowing its shape, so no bidding-specific import lands here.
  comparison?: ReactNode;
  locale: Locale;
  messages: Messages;
  tender: TenderDraft;
}>;

function TenderAttachments({
  attachments,
  locale,
  messages,
}: Readonly<{
  attachments: readonly TenderAttachmentView[];
  locale: Locale;
  messages: Messages;
}>) {
  const units = {
    bytes: messages.tenders.attachmentSizeBytes,
    kilobytes: messages.tenders.attachmentSizeKilobytes,
    megabytes: messages.tenders.attachmentSizeMegabytes,
  };

  return (
    <section
      className="tender-attachments"
      aria-labelledby="attachments-heading"
    >
      <h2 id="attachments-heading">{messages.tenders.attachments}</h2>
      <ul className="attachment-gallery">
        {attachments.map((attachment) => (
          <li key={attachment.id}>
            <a
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              download={attachment.originalFileName}
            >
              {attachment.mimeType.startsWith("image/") ? (
                // `next/image` is deliberately avoided: it would fetch this
                // owner-only signed URL through the image optimizer and cache
                // the optimized copy on disk, keyed by URL and served without
                // re-checking ownership. A plain element keeps a private
                // attachment private, and the short signature TTL would defeat
                // the optimizer's caching anyway.
                //
                // The file name is already the link's accessible name, so the
                // preview stays decorative rather than repeating it.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={attachment.url} alt="" loading="lazy" />
              ) : null}
              <span className="attachment-name">
                {attachment.originalFileName}
              </span>
            </a>
            <span className="attachment-size">
              {formatAttachmentSize(attachment.sizeBytes, locale, units)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

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
  attachments = [],
  cancelControl,
  comparison,
  hasBids = false,
  publishControl,
  locale,
  messages,
  tender,
}: TenderDetailContentProps) {
  const fallback = messages.tenders.notProvided;
  const statusLabels: Readonly<Record<TenderStatus, string>> = {
    DRAFT: messages.tenders.statusDraft,
    PUBLISHED: messages.tenders.statusPublished,
    CLOSED: messages.tenders.statusClosed,
    EXPIRED: messages.tenders.statusExpired,
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
          value={specialtyLabel(tender.specialty, messages)}
        />
        <DetailRow
          label={messages.tenders.filterService}
          value={serviceLabel(tender.serviceCode, messages)}
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
      {location ? (
        <section className="tender-map" aria-labelledby="map-heading">
          <h2 id="map-heading">{messages.tenders.mapHeading}</h2>
          <LocationMap
            coordinates={location.exact}
            precision="PRECISE"
            copy={locationMapCopy(messages)}
          />
        </section>
      ) : null}
      {attachments.length > 0 ? (
        <TenderAttachments
          attachments={attachments}
          locale={locale}
          messages={messages}
        />
      ) : null}
      {tender.status === "DRAFT" && publishControl ? (
        <section className="tender-publish" aria-labelledby="publish-heading">
          <h2 id="publish-heading">{messages.tenders.publish}</h2>
          {publishControl}
        </section>
      ) : null}
      {tender.status !== "CANCELLED" && cancelControl ? (
        <section className="tender-cancel" aria-labelledby="cancel-heading">
          <h2 id="cancel-heading">{messages.tenders.cancel}</h2>
          {hasBids ? (
            <p className="tender-action-hint">
              {messages.tenders.errors.tenderHasBids}
            </p>
          ) : (
            cancelControl
          )}
        </section>
      ) : null}
      {comparison}
    </>
  );
}

// Every URL is signed for this owner at render time. An attachment whose
// signature cannot be produced is dropped rather than rendered as a broken
// link, which keeps a storage fault from hiding the rest of the tender.
//
// These links are embedded in the markup and clicked whenever the owner gets
// to them, so they are signed for the longer server-rendered lifetime rather
// than the API route's one-round-trip default.
async function resolveOwnerAttachments(
  tenderId: string,
  actor: TenderActor,
): Promise<readonly TenderAttachmentView[]> {
  const listed = await listTenderAttachments(tenderId, actor);
  if (!listed.ok) return [];

  const resolved = await Promise.all(
    listed.value.map(async (attachment) => {
      const download = await getAttachmentDownload(
        tenderId,
        attachment.id,
        actor,
        RENDERED_LINK_DOWNLOAD_URL_TTL_SECONDS,
      );
      if (!download.ok) return null;
      return {
        id: attachment.id,
        originalFileName: attachment.originalFileName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        url: download.value,
      };
    }),
  );
  return resolved.filter((view) => view !== null);
}

export async function TenderDetail({
  actor,
  comparison,
  hasBids = false,
  id,
  locale,
  messages,
  tender,
}: Readonly<{
  actor: TenderActor;
  comparison?: ReactNode;
  hasBids?: boolean;
  id: string;
  locale: Locale;
  messages: Messages;
  tender?: TenderDraft;
}>) {
  const owned = tender
    ? ({ ok: true, value: tender } as const)
    : await getOwnedTender(id, actor);
  if (!owned.ok) return null;

  const attachments = await resolveOwnerAttachments(id, actor);

  return (
    <IdentityShell
      eyebrow={
        <Link className="back-link" href={`/${locale}/client/tenders`}>
          {messages.tenders.backToList}
        </Link>
      }
      title={owned.value.title}
      width="wide"
    >
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
        attachments={attachments}
        {...(comparison === undefined ? {} : { comparison })}
        hasBids={hasBids}
        locale={locale}
        messages={messages}
        tender={owned.value}
        publishControl={
          <PublishTenderForm tenderId={id} copy={publishTenderCopy(messages)} />
        }
        cancelControl={
          <CancelTenderForm tenderId={id} copy={cancelTenderCopy(messages)} />
        }
      />
    </IdentityShell>
  );
}
