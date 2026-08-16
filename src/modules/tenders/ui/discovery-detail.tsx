import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import type { ProviderTenderView } from "../application/get-tender-for-provider";
import type { TenderAttachmentView } from "./tender-detail";
import { LocationMap } from "./location-map";
import { locationMapCopy } from "./tender-action-copy";
import { formatTenderDate, formatTenderMoney } from "./tender-format";

function DetailRow({
  label,
  value,
}: Readonly<{ label: string; value: string | number }>) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatCoordinate(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 3,
  }).format(value);
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

  return (
    <>
      <dl className="tender-detail">
        <DetailRow label={messages.tenders.reference} value={tender.id} />
        <DetailRow
          label={messages.tenders.filterSpecialty}
          value={messages.tenders.specialtyConstructionRepair}
        />
        <DetailRow label={messages.tenders.title} value={tender.title} />
        <DetailRow
          label={messages.tenders.shortDescription}
          value={tender.shortDescription}
        />
        <DetailRow
          label={messages.tenders.fullDescription}
          value={tender.fullDescription}
        />
        <DetailRow
          label={messages.tenders.scopeOfWork}
          value={tender.scopeOfWork}
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
        <DetailRow label={messages.tenders.city} value={tender.city} />
        <DetailRow
          label={messages.tenders.district}
          value={tender.district ?? fallback}
        />
        <DetailRow
          label={messages.tenders.approximateCoordinates}
          value={approximateCoordinates}
        />
        <DetailRow
          label={messages.tenders.publishedAt}
          value={formatTenderDate(tender.publishedAt, locale) ?? fallback}
        />
        {disclosure === "FULL" ? (
          <>
            <DetailRow
              label={messages.tenders.addressLine}
              value={tender.addressLine}
            />
            <DetailRow
              label={messages.tenders.conditions}
              value={tender.conditions ?? fallback}
            />
          </>
        ) : null}
      </dl>
      {/*
        Masked disclosure carries only the coarsened point, so the map is fed
        the same coordinates the provider already received and draws an area
        rather than a pin, per The Coarse-Circle Rule. Full disclosure feeds
        the exact pin the entitlement unlocked.
      */}
      <section className="tender-map" aria-labelledby="map-heading">
        <h2 id="map-heading">{messages.tenders.mapHeading}</h2>
        <LocationMap
          coordinates={
            disclosure === "FULL"
              ? { latitude: tender.exactLatitude, longitude: tender.exactLongitude }
              : { latitude: tender.publicLatitude, longitude: tender.publicLongitude }
          }
          precision={disclosure === "FULL" ? "PRECISE" : "APPROXIMATE"}
          copy={locationMapCopy(messages)}
        />
      </section>
      {disclosure === "FULL" && attachments !== undefined ? (
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
    </>
  );
}
