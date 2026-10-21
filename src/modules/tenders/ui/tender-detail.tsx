import Link from "next/link";
import type { ReactNode } from "react";
import type { TenderActor } from "../application/create-tender-draft";
import {
  RENDERED_LINK_DOWNLOAD_URL_TTL_SECONDS,
  getAttachmentDownload,
} from "../application/get-attachment-download";
import { getOwnedTender } from "../application/get-owned-tender";
import { listTenderAttachments } from "../application/list-tender-attachments";
import type { TenderDraft } from "../domain/tender";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import { CancelTenderForm } from "./cancel-tender-form";
import { PublishTenderForm } from "./publish-tender-form";
import { cancelTenderCopy, publishTenderCopy } from "./tender-action-copy";
import { serviceLabel, specialtyLabel } from "./tender-taxonomy";
import { TenderHeading, tenderDate } from "./tender-heading";
import { TenderSections, TenderSectionNav } from "./tender-sections";
import { TenderIcon } from "./tender-icon";
import { tenderPageCopy } from "./tender-page-copy";
import { canEditTender } from "../domain/edit-eligibility";

export type TenderAttachmentView = Readonly<{
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}>;

export function TenderDetailContent({
  attachments = [],
  cancelControl,
  comparison,
  hasBids = false,
  offerCount = 0,
  publishControl,
  locale,
  messages,
  tender,
}: {
  attachments?: readonly TenderAttachmentView[];
  cancelControl?: ReactNode;
  comparison?: ReactNode;
  hasBids?: boolean;
  offerCount?: number;
  publishControl?: ReactNode;
  locale: Locale;
  messages: Messages;
  tender: TenderDraft;
}) {
  const c = tenderPageCopy(locale);
  const showsComparison =
    offerCount > 0 ||
    tender.status === "AWAITING_SELECTION" ||
    tender.status === "CLOSED" ||
    tender.status === "EXPIRED";
  const status = {
    DRAFT: messages.tenders.statusDraft,
    PUBLISHED: messages.tenders.statusPublished,
    AWAITING_SELECTION: messages.tenders.statusAwaitingSelection,
    CLOSED: messages.tenders.statusClosed,
    EXPIRED: messages.tenders.statusExpired,
    CANCELLED: messages.tenders.statusCancelled,
  }[tender.status];
  const publicHref = `/${locale}/provider/tenders/${tender.id}`;
  const editHref =
    tender.status === "DRAFT"
      ? `/${locale}/client/tenders/new?tenderId=${tender.id}`
      : `/${locale}/client/tenders/${tender.id}/edit`;
  const showPublic =
    tender.publishedAt !== null && tender.status !== "CANCELLED";
  const manageable = tender.status === "DRAFT" || tender.status === "PUBLISHED";
  const editable = canEditTender(tender, offerCount);
  return (
    <>
      <TenderHeading
        title={tender.title}
        category={specialtyLabel(tender.specialty, messages)}
        service={serviceLabel(tender.serviceCode, messages)}
        status={status}
        owner
        city={
          [tender.location?.city, tender.location?.district]
            .filter(Boolean)
            .join(", ") || messages.tenders.notProvided
        }
        budget={tender.budgetMinorUnits}
        currency={tender.currency}
        deadline={tender.deadline}
        start={tender.desiredStartDate}
        publishedAt={tender.publishedAt}
        reference={tender.reference ?? null}
        id={tender.id}
        locale={locale}
        messages={messages}
        actions={
          <>
            {editable ? (
              <Link className="tender-button primary" href={editHref}>
                <TenderIcon name="edit" size={17} />
                {c.edit}
              </Link>
            ) : manageable ? (
              <button className="tender-button" disabled title={c.editBlocked}>
                <TenderIcon name="lock" size={17} />
                {c.edit}
              </button>
            ) : null}
            {showPublic ? (
              <Link className="tender-button" href={publicHref}>
                <TenderIcon name="external" size={17} />
                {c.publicPage}
              </Link>
            ) : null}
            <details className="tender-overflow">
              <summary className="tender-button icon-only" aria-label={c.more}>
                <TenderIcon name="more" />
              </summary>
              <div>
                <a href="#history">{c.history}</a>
                {manageable ? <a href="#management">{c.manage}</a> : null}
              </div>
            </details>
          </>
        }
      />
      <div
        className="tender-detail-grid owner-detail"
        data-tender-status={tender.status}
      >
        <TenderSectionNav locale={locale} />
        <div className="tender-detail-body">
          <TenderSections
            locale={locale}
            messages={messages}
            description={tender.fullDescription || tender.shortDescription}
            scope={tender.scopeOfWork}
            workerNotes={tender.workerNotes}
            materialNotes={tender.materialNotes}
            equipmentNotes={tender.equipmentNotes}
            conditions={tender.conditions}
            workItems={tender.workItems ?? []}
            attachments={attachments}
            owner
            full
            city={tender.location?.city ?? ""}
            address={
              tender.location
                ? [
                    tender.location.addressLine,
                    tender.location.district,
                    tender.location.city,
                  ]
                    .filter(Boolean)
                    .join(", ")
                : null
            }
            coordinates={tender.location?.exact ?? null}
          />
          <details id="history" className="tender-panel tender-history">
            <summary>
              <strong>{c.history}</strong>
              <span className="tender-muted">
                {messages.tenders.publishedAt}{" "}
                {tenderDate(tender.publishedAt, locale)}
              </span>
              <TenderIcon name="chevron" size={18} />
            </summary>
            <dl>
              {[
                [messages.tenders.createdAt, tender.createdAt],
                [messages.tenders.updatedAt, tender.updatedAt],
                [messages.tenders.publishedAt, tender.publishedAt],
                [messages.tenders.cancelledAt, tender.cancelledAt],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt>{String(label)}</dt>
                  <dd>{tenderDate(value as Date | null, locale, true)}</dd>
                </div>
              ))}
              {tender.cancelReason ? (
                <div>
                  <dt>{messages.tenders.cancelReason}</dt>
                  <dd>{tender.cancelReason}</dd>
                </div>
              ) : null}
            </dl>
          </details>
          {tender.status === "DRAFT" && publishControl ? (
            <section className="tender-panel" id="publish-heading">
              <h2>{messages.tenders.publish}</h2>
              {publishControl}
            </section>
          ) : null}
          {showsComparison ? (
            <div id="offer-comparison">{comparison}</div>
          ) : null}
        </div>
        <div className="owner-rail">
          {" "}
          <section id="offers" className="tender-panel tender-offers">
            <div className="tender-panel-heading split">
              <h2>{c.offers}</h2>
              <span className="tender-badge">{offerCount}</span>
            </div>
            {offerCount === 0 ? (
              <div className="tender-offers-empty">
                <TenderIcon name="inbox" size={48} />
                <h3>{c.noOffers}</h3>
                <p className="tender-muted">{c.offersHint}</p>
              </div>
            ) : (
              <a className="tender-button" href="#offer-comparison">
                {c.offersShort} · {offerCount}
              </a>
            )}
            {/* Once the comparison renders it states the rule next to the
                offers; repeating it here would show the sentence twice. */}
            {showsComparison ? null : (
              <p className="tender-privacy">{c.selectionRuleOwner}</p>
            )}
          </section>
          <aside className="tender-sidebar owner-sidebar">
            <section className="tender-panel">
              <div className="tender-panel-heading split">
                <h2>{c.status}</h2>
                <span className="tender-badge">{status}</span>
              </div>
              <dl className="tender-status-facts">
                <div>
                  <dt>{messages.tenders.deadline}</dt>
                  <dd>{tenderDate(tender.deadline, locale, true)}</dd>
                </div>
                {tender.status === "AWAITING_SELECTION" &&
                tender.selectionExpiresAt ? (
                  <div>
                    <dt>{messages.tenders.selectionExpiresAt}</dt>
                    <dd>
                      {tenderDate(tender.selectionExpiresAt, locale, true)}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>{messages.tenders.desiredStartDate}</dt>
                  <dd>{tenderDate(tender.desiredStartDate, locale)}</dd>
                </div>
              </dl>
              {manageable && !editable ? (
                <p className="tender-small-note">{c.editBlocked}</p>
              ) : null}
            </section>
            <section className="tender-panel" id="management">
              <h2>{c.manage}</h2>
              {showPublic ? (
                <Link className="tender-management-link" href={publicHref}>
                  <TenderIcon name="external" />
                  {c.publicPage}
                  <TenderIcon name="arrow" size={17} />
                </Link>
              ) : null}
              <a className="tender-management-link" href="#history">
                <TenderIcon name="calendar" />
                {c.history}
                <TenderIcon name="arrow" size={17} />
              </a>
              {manageable && cancelControl ? (
                <details
                  className="tender-cancel-disclosure"
                  id="cancel-heading"
                >
                  <summary className="tender-management-link">
                    <TenderIcon name="trash" />
                    {messages.tenders.cancel}
                    <TenderIcon name="chevron" size={17} />
                  </summary>
                  {hasBids ? (
                    <p className="tender-muted">
                      {messages.tenders.errors.tenderHasBids}
                    </p>
                  ) : (
                    <>
                      {cancelControl}
                      <p className="tender-muted">{c.cancelHint}</p>
                    </>
                  )}
                </details>
              ) : null}
            </section>
          </aside>
        </div>
      </div>
      <div className="tender-mobile-actions owner-actions">
        <a className="tender-button" href="#offers">
          <TenderIcon name="inbox" />
          {c.offersShort}
          <span className="tender-badge neutral">{offerCount}</span>
        </a>
        {editable ? (
          <Link className="tender-button primary" href={editHref}>
            <TenderIcon name="edit" />
            {c.edit}
          </Link>
        ) : manageable ? (
          <button className="tender-button" disabled title={c.editBlocked}>
            <TenderIcon name="lock" />
            {c.edit}
          </button>
        ) : showPublic ? (
          <Link className="tender-button primary" href={publicHref}>
            {c.publicPage}
          </Link>
        ) : null}
      </div>
    </>
  );
}

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
  offerCount = 0,
  id,
  locale,
  messages,
  tender,
}: {
  actor: TenderActor;
  comparison?: ReactNode;
  hasBids?: boolean;
  offerCount?: number;
  id: string;
  locale: Locale;
  messages: Messages;
  tender?: TenderDraft;
}) {
  const owned = tender
    ? ({ ok: true, value: tender } as const)
    : await getOwnedTender(id, actor);
  if (!owned.ok) return null;
  const attachments = await resolveOwnerAttachments(id, actor);
  return (
    <div className="tender-page">
      <div className="tender-container">
        <Link className="tender-back" href={`/${locale}/client/tenders`}>
          <TenderIcon name="back" size={16} />
          {tenderPageCopy(locale).back}
        </Link>
        <TenderDetailContent
          attachments={attachments}
          {...(comparison === undefined ? {} : { comparison })}
          hasBids={hasBids}
          offerCount={offerCount}
          locale={locale}
          messages={messages}
          tender={owned.value}
          publishControl={
            <PublishTenderForm
              tenderId={id}
              copy={publishTenderCopy(messages)}
            />
          }
          cancelControl={
            <CancelTenderForm tenderId={id} copy={cancelTenderCopy(messages)} />
          }
        />
      </div>
    </div>
  );
}
