import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireCapability } from "@/src/modules/identity/application/require-capability";
import { IdentityShell } from "@/src/modules/identity/ui/identity-shell";
import { WorkspaceDenied } from "@/src/modules/identity/ui/workspace-view";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { getPublishedTender } from "@/src/modules/tenders/application/get-published-tender";
import { DiscoveryDetailContent } from "@/src/modules/tenders/ui/discovery-detail";

export default async function ProviderTenderDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string; locale: string }> }>) {
  const [{ id, locale }, requestHeaders] = await Promise.all([
    params,
    headers(),
  ]);
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const access = await requireCapability(requestHeaders, "PROVIDER");
  if (!access.ok) {
    if (access.error === "UNAUTHENTICATED") {
      redirect(`/${locale}/login`);
    }
    return (
      <WorkspaceDenied
        error={access.error}
        locale={locale}
        messages={messages}
      />
    );
  }

  const tender = await getPublishedTender(id);
  if (!tender.ok) notFound();

  return (
    <IdentityShell title={tender.value.title}>
      <Link className="back-link" href={`/${locale}/provider/tenders`}>
        {messages.tenders.providerBackToList}
      </Link>
      <DiscoveryDetailContent
        locale={locale}
        messages={messages}
        tender={tender.value}
      />
    </IdentityShell>
  );
}
