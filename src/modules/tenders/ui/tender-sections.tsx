import type { ReactNode } from "react";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import type { WorkItem } from "../domain/work-item";
import { LocationMap } from "./location-map";
import { locationMapCopy } from "./tender-action-copy";
import { formatAttachmentSize, tenderNumberFormat } from "./tender-format";
import { TenderIcon } from "./tender-icon";
import { tenderPageCopy } from "./tender-page-copy";
import { TenderGallery } from "./tender-gallery";
import { AttachmentDownloadButton } from "./attachment-download-button";

export type AttachmentPreview = Readonly<{
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string | null;
}>;
export const isPhoto = (file: { mimeType: string }) =>
  file.mimeType.startsWith("image/") && file.mimeType !== "image/vnd.dwg";
export function TenderSectionNav({ locale }: { locale: Locale }) {
  const c = tenderPageCopy(locale);
  return (
    <nav className="tender-section-nav" aria-label={c.overview}>
      <a href="#overview">{c.overview}</a>
      <a href="#quantities">
        <span className="desktop-label">{c.quantities}</span>
        <span className="mobile-label">{c.quantitiesShort}</span>
      </a>
      <a href="#attachments">
        <span className="desktop-label">
          {locale === "ka"
            ? "დანართები"
            : locale === "ru"
              ? "Вложения"
              : "Attachments"}
        </span>
        <span className="mobile-label">{c.files}</span>
      </a>
      <a href="#location">{c.location}</a>
    </nav>
  );
}
export function TenderSections({
  locale,
  messages,
  description,
  scope,
  workerNotes,
  materialNotes,
  equipmentNotes,
  conditions,
  workItems = [],
  attachments = [],
  owner = false,
  full = false,
  city,
  address,
  coordinates,
  afterLocation,
}: {
  locale: Locale;
  messages: Messages;
  description: string | null;
  scope: string | null;
  workerNotes: string | null;
  materialNotes: string | null;
  equipmentNotes: string | null;
  conditions?: string | null;
  workItems?: readonly WorkItem[];
  attachments?: readonly AttachmentPreview[];
  owner?: boolean;
  full?: boolean;
  city: string;
  address?: string | null;
  coordinates: { latitude: number; longitude: number } | null;
  afterLocation?: ReactNode;
}) {
  const c = tenderPageCopy(locale);
  const photos = attachments.filter(isPhoto);
  const documents = attachments.filter((file) => !isPhoto(file));
  return (
    <>
      <section id="overview" className="tender-panel tender-overview">
        <h2>{c.projectOverview}</h2>
        <p className="tender-description">
          {description ?? messages.tenders.notProvided}
        </p>
        <div className="tender-requirements">
          <div>
            <TenderIcon name="team" />
            <div>
              <h3>{c.team}</h3>
              <p>{workerNotes ?? messages.tenders.notProvided}</p>
            </div>
          </div>
          <div>
            <TenderIcon name="box" />
            <div>
              <h3>{c.materials}</h3>
              <p>{materialNotes ?? messages.tenders.notProvided}</p>
            </div>
          </div>
          {equipmentNotes ? (
            <div>
              <TenderIcon name="box" />
              <div>
                <h3>{messages.tenders.equipmentNotes}</h3>
                <p>{equipmentNotes}</p>
              </div>
            </div>
          ) : null}
        </div>
        {full && conditions ? (
          <p className="tender-description">{conditions}</p>
        ) : null}
      </section>
      <section id="quantities" className="tender-panel">
        <h2>{c.quantities}</h2>
        <p className="tender-muted tender-subtitle">{c.scope}</p>
        {workItems.length ? (
          <>
            <table className="quantity-table">
              <thead>
                <tr>
                  <th scope="col">{c.item}</th>
                  <th scope="col">{c.quantity}</th>
                  <th scope="col" aria-label={c.unit} title={c.unit}>
                    {c.unitShort}
                  </th>
                </tr>
              </thead>
              <tbody>
                {workItems.map((item, index) => (
                  <tr key={index}>
                    <td>{item.name}</td>
                    <td>
                      {tenderNumberFormat(locale, {
                        maximumFractionDigits: 4,
                      }).format(item.quantity)}
                    </td>
                    <td>{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="tender-small-note">
              <TenderIcon name="info" size={14} />
              {owner ? c.suppliedOwner : c.supplied}
            </p>
          </>
        ) : (
          <p className="tender-description">{scope || c.noQuantities}</p>
        )}
      </section>
      <section id="attachments" className="tender-panel">
        <div className="tender-panel-heading">
          <h2>{messages.tenders.attachments}</h2>
          <span className="tender-badge neutral">
            {attachments.length} {c.filesCount}
          </span>
        </div>
        {photos.length ? (
          <TenderGallery photos={photos} locale={locale} />
        ) : null}
        {documents.length ? (
          <ul className="tender-documents">
            {documents.map((file) => {
              const type =
                file.mimeType === "application/pdf"
                  ? "PDF"
                  : file.mimeType === "image/vnd.dwg"
                    ? "DWG"
                    : (file.originalFileName.split(".").at(-1)?.toUpperCase() ??
                      "FILE");
              return (
                <li key={file.id}>
                  <span
                    className={`tender-file-icon ${type === "PDF" ? "pdf" : "cad"}`}
                  >
                    {type}
                  </span>
                  <div className="tender-file-meta">
                    <strong>{file.originalFileName}</strong>
                    <span>
                      {type} ·{" "}
                      {formatAttachmentSize(file.sizeBytes, locale, {
                        bytes: messages.tenders.attachmentSizeBytes,
                        kilobytes: messages.tenders.attachmentSizeKilobytes,
                        megabytes: messages.tenders.attachmentSizeMegabytes,
                      })}
                    </span>
                  </div>
                  {file.url ? (
                    <div className="tender-document-actions">
                      {type === "PDF" ? (
                        <a
                          className="tender-button small"
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {c.preview}
                        </a>
                      ) : null}
                      <AttachmentDownloadButton
                        url={file.url}
                        fileName={file.originalFileName}
                        label={c.download}
                        errorLabel={messages.errors.generic}
                      />
                    </div>
                  ) : (
                    <span
                      className="tender-muted"
                      aria-label={c.attachmentPrivacy}
                    >
                      <TenderIcon name="lock" size={16} />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
        {!attachments.length ? (
          <p className="tender-muted">{c.noAttachments}</p>
        ) : (
          <p className="tender-privacy">
            <TenderIcon name="lock" size={16} />
            {owner
              ? c.ownerAttachmentPrivacy
              : full
                ? messages.entitlements.unlocked
                : c.attachmentPrivacy}
          </p>
        )}
      </section>
      <section id="location" className="tender-panel tender-location">
        <div className="tender-panel-heading split">
          <h2>{c.location}</h2>
          {owner ? (
            <span className="tender-badge">
              <TenderIcon name="lock" size={13} />
              {c.visible}
            </span>
          ) : !full ? (
            <span className="tender-muted">
              {messages.detail.approximateOnly}
            </span>
          ) : null}
        </div>
        {full && address ? <p className="tender-address">{address}</p> : null}
        <LocationMap
          coordinates={coordinates}
          precision={full ? "PRECISE" : "APPROXIMATE"}
          copy={locationMapCopy(messages)}
        />
        <div className="tender-map-caption">
          {!full ? (
            <strong>
              <TenderIcon name="pin" size={18} />
              {city}
            </strong>
          ) : null}
          <span>
            <TenderIcon name="lock" size={15} />
            {owner
              ? c.ownerExactPrivacy
              : full
                ? messages.entitlements.unlocked
                : c.exactPrivacy}
          </span>
        </div>
      </section>
      {afterLocation}
    </>
  );
}
