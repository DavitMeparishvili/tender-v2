import type { ReactNode } from "react";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import type { ProviderTenderView } from "../application/get-tender-for-provider";
import { TenderHeading } from "./tender-heading";
import {
  TenderSections,
  TenderSectionNav,
  type AttachmentPreview,
} from "./tender-sections";
import { serviceLabel, specialtyLabel } from "./tender-taxonomy";
import { tenderPageCopy } from "./tender-page-copy";

export function DiscoveryDetailContent({
  attachments,
  locale,
  messages,
  view,
  sidebar,
  children,
}: {
  attachments?: readonly AttachmentPreview[];
  locale: Locale;
  messages: Messages;
  view: ProviderTenderView;
  sidebar?: ReactNode;
  children?: ReactNode;
}) {
  const { tender } = view;
  const c = tenderPageCopy(locale);
  return (
    <>
      <TenderHeading
        title={tender.title}
        category={specialtyLabel(tender.specialty, messages)}
        service={serviceLabel(tender.serviceCode, messages)}
        status={
          tender.status === "PUBLISHED" &&
          new Date(tender.deadline) > new Date()
            ? messages.detail.openForOffers
            : c.ended
        }
        city={[tender.city, tender.district].filter(Boolean).join(", ")}
        budget={tender.budgetMinorUnits}
        currency={tender.currency}
        deadline={tender.deadline}
        start={tender.desiredStartDate}
        publishedAt={tender.publishedAt}
        reference={tender.reference ?? null}
        id={tender.id}
        locale={locale}
        messages={messages}
        ownerIsVip={tender.ownerIsVip}
      />
      <div className="tender-detail-grid public-detail">
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
            workItems={tender.workItems ?? []}
            attachments={attachments ?? []}
            full={view.disclosure === "FULL"}
            city={tender.city}
            address={
              view.disclosure === "FULL" ? view.tender.addressLine : null
            }
            conditions={
              view.disclosure === "FULL" ? view.tender.conditions : null
            }
            coordinates={
              view.disclosure === "FULL"
                ? {
                    latitude: view.tender.exactLatitude,
                    longitude: view.tender.exactLongitude,
                  }
                : {
                    latitude: tender.publicLatitude,
                    longitude: tender.publicLongitude,
                  }
            }
          />
        </div>
        <aside className="tender-sidebar">{sidebar}</aside>
        <div className="tender-detail-after">{children}</div>
      </div>
    </>
  );
}
