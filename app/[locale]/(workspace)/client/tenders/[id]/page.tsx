import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireCapability } from "@/src/modules/identity/application/require-capability";
import { WorkspaceDenied } from "@/src/modules/identity/ui/workspace-view";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { getOwnedTender } from "@/src/modules/tenders/application/get-owned-tender";
import { TenderDetail } from "@/src/modules/tenders/ui/tender-detail";

export default async function ClientTenderDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string; locale: string }> }>) {
  const [{ id, locale }, requestHeaders] = await Promise.all([
    params,
    headers(),
  ]);
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const access = await requireCapability(requestHeaders, "CUSTOMER");
  if (!access.ok) {
    if (access.error === "UNAUTHENTICATED") {
      redirect("/" + locale + "/login");
    }
    return (
      <WorkspaceDenied
        error={access.error}
        locale={locale}
        messages={messages}
      />
    );
  }

  const owned = await getOwnedTender(id, access.value);
  if (!owned.ok) notFound();

  return (
    <TenderDetail
      actor={access.value}
      id={id}
      locale={locale}
      messages={messages}
      tender={owned.value}
    />
  );
}
