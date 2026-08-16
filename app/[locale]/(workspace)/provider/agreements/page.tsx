import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { listAgreements } from "@/src/modules/agreements/application/get-agreement";
import { AgreementList } from "@/src/modules/agreements/ui/agreement-list";
import { requireCapability } from "@/src/modules/identity/application/require-capability";
import { IdentityShell } from "@/src/modules/identity/ui/identity-shell";
import { WorkspaceDenied } from "@/src/modules/identity/ui/workspace-view";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const [{ locale }, requestHeaders] = await Promise.all([params, headers()]);
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const access = await requireCapability(requestHeaders, "PROVIDER");
  if (!access.ok) {
    if (access.error === "UNAUTHENTICATED") redirect(`/${locale}/login`);
    return (
      <WorkspaceDenied
        error={access.error}
        locale={locale}
        messages={messages}
      />
    );
  }
  const agreements = await listAgreements(access.value, "PROVIDER");
  return (
    <IdentityShell title={messages.agreements.title} width="wide">
      <AgreementList
        agreements={agreements}
        locale={locale}
        messages={messages}
      />
    </IdentityShell>
  );
}
