import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireCapability } from "@/src/modules/identity/application/require-capability";
import { WorkspaceDenied } from "@/src/modules/identity/ui/workspace-view";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { TenderList } from "@/src/modules/tenders/ui/tender-list";
import { resolveCustomerRouteAccess } from "@/src/modules/tenders/ui/customer-route-access";

export default async function ClientTenderListPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const [{ locale }, requestHeaders] = await Promise.all([params, headers()]);
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const access = await requireCapability(requestHeaders, "CUSTOMER");
  const routeAccess = resolveCustomerRouteAccess(access);
  if (routeAccess.kind === "LOGIN") {
    redirect("/" + locale + "/login");
  }
  if (routeAccess.kind === "DENIED") {
    return (
      <WorkspaceDenied
        error={routeAccess.error}
        locale={locale}
        messages={messages}
      />
    );
  }

  return (
    <TenderList actor={routeAccess.actor} locale={locale} messages={messages} />
  );
}
