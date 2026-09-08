import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireCapability } from "@/src/modules/identity/application/require-capability";
import { getOwnedTender } from "@/src/modules/tenders/application/get-owned-tender";
import { listTenderBids } from "@/src/modules/bidding/application/list-tender-bids";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { tenderPageCopy } from "@/src/modules/tenders/ui/tender-page-copy";
import { PublishedTenderEditor } from "@/src/modules/tenders/ui/published-tender-editor";

export default async function EditPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  if (!isLocale(locale)) notFound();
  const access = await requireCapability(await headers(), "CUSTOMER");
  if (!access.ok) redirect(`/${locale}/login`);
  const [owned, bids] = await Promise.all([
    getOwnedTender(id, access.value),
    listTenderBids(id, access.value),
  ]);
  if (!owned.ok) notFound();
  const tender = owned.value;
  if (tender.status === "DRAFT")
    redirect(`/${locale}/client/tenders/new?tenderId=${id}`);
  const messages = getMessages(locale);
  const c = tenderPageCopy(locale);
  const allowed =
    tender.status === "PUBLISHED" &&
    tender.deadline !== null &&
    tender.deadline > new Date() &&
    bids.ok &&
    bids.value.length === 0;
  return (
    <div className="tender-page">
      <div className="tender-container tender-editor">
        <Link className="tender-back" href={`/${locale}/client/tenders/${id}`}>
          {messages.tenders.viewDetail}
        </Link>
        <section className="tender-panel">
          <h1>{c.edit}</h1>
          {allowed ? (
            <PublishedTenderEditor
              id={id}
              locale={locale}
              initial={{
                title: tender.title,
                fullDescription: tender.fullDescription ?? "",
                workerNotes: tender.workerNotes,
                materialNotes: tender.materialNotes,
                equipmentNotes: tender.equipmentNotes,
                areaSquareMeters: tender.areaSquareMeters ?? null,
                workItems: [...(tender.workItems ?? [])],
              }}
              labels={{
                title: messages.tenders.title,
                description: c.projectOverview,
                team: c.team,
                materials: c.materials,
                equipment: messages.tenders.equipmentNotes,
                error: messages.errors.generic,
              }}
            />
          ) : (
            <p className="tender-description">{c.editBlocked}</p>
          )}
        </section>
      </div>
    </div>
  );
}
