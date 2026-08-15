import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireCapability } from "@/src/modules/identity/application/require-capability";
import { WorkspaceDenied } from "@/src/modules/identity/ui/workspace-view";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { TenderList } from "@/src/modules/tenders/ui/tender-list";

export default async function ClientTenderListPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const [{ locale }, requestHeaders] = await Promise.all([params, headers()]);
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

  return (
    <TenderList actor={access.value} locale={locale} messages={messages} />
  );
}
