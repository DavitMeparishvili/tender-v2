import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireCapability } from "@/src/modules/identity/application/require-capability";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { getOwnedTender } from "@/src/modules/tenders/application/get-owned-tender";
import { listTenderAttachments } from "@/src/modules/tenders/application/list-tender-attachments";
import { TenderWizard } from "@/src/modules/tenders/ui/tender-wizard";
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

  const tenderId =
    typeof query.tenderId === "string" ? query.tenderId.trim() : undefined;
  if (!tenderId) {
    return <TenderWizard locale={locale} messages={getMessages(locale)} />;
  }

  const [owned, attachments] = await Promise.all([
    getOwnedTender(tenderId, access.value),
    listTenderAttachments(tenderId, access.value),
  ]);
  if (!owned.ok || !attachments.ok) notFound();
  if (owned.value.status !== "DRAFT") {
    redirect(`/${locale}/client/tenders/${tenderId}`);
  }

  return (
    <TenderWizard
      locale={locale}
      messages={getMessages(locale)}
      initialTenderId={tenderId}
      initialForm={tenderToWizardForm(
        owned.value,
        attachments.value.map(({ originalFileName }) => originalFileName),
      )}
    />
  );
}
