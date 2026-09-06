import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import { BrandIcon } from "../../shell/ui/brand-icon";
import { DeadlineCountdown } from "../../shell/ui/deadline-countdown";
import type { ProviderTenderView } from "../application/get-tender-for-provider";
import type { TenderAttachmentView } from "./tender-detail";
import { LocationMap } from "./location-map";
import { locationMapCopy } from "./tender-action-copy";
import { formatTenderDate, formatTenderMoney } from "./tender-format";
import { serviceLabel, specialtyLabel } from "./tender-taxonomy";
import { specialtyTone } from "./tender-tone";

function formatCoordinate(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 3,
  }).format(value);
}

/**
 * A field with nothing in it still reads as a field: the label stays, and the
 * value renders as "Not provided" in the muted tone rather than collapsing —
 * so a provider can tell "the client left this blank" apart from "this page
 * does not have that field".
 */
function Field({
  label,
  value,
  fallback,
}: Readonly<{ label: string; value: string | null; fallback: string }>) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={value === null ? "is-empty" : undefined}>
        {value ?? fallback}
      </dd>
    </div>
  );
}

export function DiscoveryDetailContent({
  attachments,
  locale,
  messages,
  view,
}: Readonly<{
  attachments?: readonly TenderAttachmentView[];
  locale: Locale;
  messages: Messages;
  view: ProviderTenderView;
}>) {
  const { disclosure, tender } = view;
  const fallback = messages.tenders.notProvided;
  const approximateCoordinates = `${formatCoordinate(
    tender.publicLatitude,
    locale,
  )}; ${formatCoordinate(tender.publicLongitude, locale)}`;
  const isOpen = tender.status === "PUBLISHED";

  return (
    <>
      {/* ---------------------------------------------------- Title card */}
      <section className="surface surface-2xl surface-pad detail-title-card">
        <div className="motif grid-bg grid-bg--fade-b" />
        <div className="detail-title-body">
          <div className="detail-tags">
            <span className={specialtyTone(tender.specialty)}>
              {specialtyLabel(tender.specialty, messages)}
            </span>
            {isOpen ? (
              <span className="tag tag-emerald">
                {messages.detail.openForOffers}
              </span>
            ) : (
              <span className="tag tag-grey">{messages.discovery.closed}</span>
            )}
            <DeadlineCountdown
              closedLabel={messages.discovery.closed}
              deadline={tender.deadline}
              locale={locale}
              messages={messages}
              template={messages.discovery.leftToBid}
            />
          </div>
          <h1 id="page-heading">{tender.title}</h1>
          <p className="detail-short">{tender.shortDescription}</p>
          <dl className="figure-grid">
            <div>
              <dt className="figure-label">{messages.tenders.budget}</dt>
              <dd className="detail-figure-amount">
                {formatTenderMoney(
                  tender.budgetMinorUnits,
                  tender.currency,
                  locale,
                ) ?? fallback}
              </dd>
            </div>
            <div>
              <dt className="figure-label">{messages.tenders.deadline}</dt>
              <dd className="detail-figure-value">
                {formatTenderDate(tender.deadline, locale) ?? fallback}
              </dd>
            </div>
            <div>
              <dt className="figure-label">{messages.tenders.publishedAt}</dt>
              <dd className="detail-figure-value">
                {formatTenderDate(tender.publishedAt, locale) ?? fallback}
              </dd>
            </div>
            <div>
              <dt className="figure-label">{messages.tenders.city}</dt>
              <dd className="detail-figure-value">{tender.city}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ---------------------------------------------- Description card */}
      <section className="surface surface-2xl surface-pad">
        <div className="detail-head-row">
          <h2 className="card-title">{messages.tenders.fullDescription}</h2>
          <span className="muted">
            {serviceLabel(tender.serviceCode, messages)}
          </span>
        </div>
        <p className="detail-prose">{tender.fullDescription}</p>
        <h3 className="detail-subhead">{messages.tenders.scopeOfWork}</h3>
        <p className="detail-prose">{tender.scopeOfWork}</p>
        <dl className="hairline-grid">
          <Field
            fallback={fallback}
            label={messages.tenders.desiredStartDate}
            value={formatTenderDate(tender.desiredStartDate, locale)}
          />
          <Field
            fallback={fallback}
            label={messages.tenders.workerNotes}
            value={tender.workerNotes}
          />
          <Field
            fallback={fallback}
            label={messages.tenders.equipmentNotes}
            value={tender.equipmentNotes}
          />
          <Field
            fallback={fallback}
            label={messages.tenders.materialNotes}
            value={tender.materialNotes}
          />
        </dl>
        {disclosure === "FULL" ? (
          <dl className="hairline-grid detail-released">
            <Field
              fallback={fallback}
              label={messages.tenders.addressLine}
              value={tender.addressLine}
            />
            <Field
              fallback={fallback}
              label={messages.tenders.conditions}
              value={tender.conditions}
            />
          </dl>
        ) : (
          <p className="note-row detail-lock-note">
            <BrandIcon name="secure" opacity={0.5} size={14} />
            {messages.detail.lockedNote}
          </p>
        )}
      </section>

      {/*
        Masked disclosure carries only the coarsened point, so the map is fed
        the same coordinates the provider already received and draws an area
        rather than a pin, per The Coarse-Circle Rule. Full disclosure feeds
        the exact pin the entitlement unlocked.
      */}
      <section
        aria-labelledby="map-heading"
        className="surface surface-2xl surface-pad tender-map"
      >
        <div className="detail-head-row detail-head-row-split">
          <h2 className="card-title" id="map-heading">
            {messages.tenders.mapHeading}
          </h2>
          {disclosure === "FULL" ? null : (
            <span className="muted">{messages.detail.approximateOnly}</span>
          )}
        </div>
        <div className="detail-map-layout">
          <LocationMap
            coordinates={
              disclosure === "FULL"
                ? {
                    latitude: tender.exactLatitude,
                    longitude: tender.exactLongitude,
                  }
                : {
                    latitude: tender.publicLatitude,
                    longitude: tender.publicLongitude,
                  }
            }
            precision={disclosure === "FULL" ? "PRECISE" : "APPROXIMATE"}
            copy={locationMapCopy(messages)}
          />
          <div className="detail-map-side">
            <dl>
              <div>
                <dt>{messages.tenders.city}</dt>
                <dd>{tender.city}</dd>
              </div>
              <div>
                <dt>{messages.tenders.district}</dt>
                <dd
                  className={tender.district === null ? "is-empty" : undefined}
                >
                  {tender.district ?? fallback}
                </dd>
              </div>
              <div>
                <dt>{messages.tenders.approximateCoordinates}</dt>
                <dd className="mono">{approximateCoordinates}</dd>
              </div>
            </dl>
            <p className="detail-map-note">
              {messages.detail.exactAddressNote}
            </p>
          </div>
        </div>
      </section>

      {disclosure === "FULL" && attachments !== undefined ? (
        <section
          aria-labelledby="attachments-heading"
          className="surface surface-2xl surface-pad tender-attachments"
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
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={attachment.url} alt="" loading="lazy" />
                  ) : null}
                  <span className="attachment-name">
                    {attachment.originalFileName}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ------------------------------------------------ Reference strip */}
      <section className="surface surface-2xl detail-reference">
        <dl>
          <dt>{messages.tenders.reference}</dt>
          <dd className="mono">{tender.id}</dd>
        </dl>
        <dl>
          <dt>{messages.tenders.filterSpecialty}</dt>
          <dd>{specialtyLabel(tender.specialty, messages)}</dd>
        </dl>
        <dl>
          <dt>{messages.tenders.filterService}</dt>
          <dd>{serviceLabel(tender.serviceCode, messages)}</dd>
        </dl>
      </section>
    </>
  );
}
