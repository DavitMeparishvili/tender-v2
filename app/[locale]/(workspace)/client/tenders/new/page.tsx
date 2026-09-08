import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireCapability } from "@/src/modules/identity/application/require-capability";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { getOwnedTender } from "@/src/modules/tenders/application/get-owned-tender";
import { listGeorgianPlaces } from "@/src/modules/tenders/application/list-georgian-places";
import { listTenderAttachments } from "@/src/modules/tenders/application/list-tender-attachments";
import { TenderAuthoring } from "@/src/modules/tenders/ui/tender-authoring";
import { getAuthoringAttachments } from "@/src/modules/tenders/application/get-authoring-attachments";
import { tenderToWizardForm } from "@/src/modules/tenders/ui/tender-wizard-initial";

export default async function NewTenderPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tenderId?: string | string[] }>;
}>) {
  const [{ locale }, query, requestHeaders] = await Promise.all([
    params,
    searchParams,
    headers(),
  ]);
  if (!isLocale(locale)) notFound();
  const access = await requireCapability(requestHeaders, "CUSTOMER");
  if (!access.ok) redirect("/" + locale + "/login");
  const placesPromise = listGeorgianPlaces(locale);

  const tenderId =
    typeof query.tenderId === "string" ? query.tenderId.trim() : undefined;
  if (!tenderId) {
    const places = await placesPromise;
    return (
      <TenderAuthoring
        locale={locale}
        messages={getMessages(locale)}
        places={places}
      />
    );
  }

  const [owned, attachments, places] = await Promise.all([
    getOwnedTender(tenderId, access.value),
    listTenderAttachments(tenderId, access.value),
    placesPromise,
  ]);
  if (!owned.ok || !attachments.ok) notFound();
  if (owned.value.status !== "DRAFT") {
    redirect(`/${locale}/client/tenders/${tenderId}`);
  }

  return (
    <TenderAuthoring
      locale={locale}
      messages={getMessages(locale)}
      places={places}
      initialTenderId={tenderId}
      initialAttachments={await getAuthoringAttachments(tenderId, access.value)}
      initialForm={tenderToWizardForm(
        owned.value,
        attachments.value.map(({ originalFileName }) => originalFileName),
      )}
    />
  );
}
