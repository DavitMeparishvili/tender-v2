import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { listAgreements } from "@/src/modules/agreements/application/get-agreement";
import {
  AgreementList,
  counterpartyOf,
} from "@/src/modules/agreements/ui/agreement-list";
import { requireCapability } from "@/src/modules/identity/application/require-capability";
import { IdentityShell } from "@/src/modules/identity/ui/identity-shell";
import { WorkspaceDenied } from "@/src/modules/identity/ui/workspace-view";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { getProviderDisplayNames } from "@/src/modules/profiles/application/get-provider-display-names";

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const [{ locale }, requestHeaders] = await Promise.all([params, headers()]);
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const access = await requireCapability(requestHeaders, "CUSTOMER");
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
  const agreements = await listAgreements(access.value, "CLIENT");
  const partyNames = await getProviderDisplayNames([
    ...new Set(agreements.map(counterpartyOf)),
  ]);
  return (
    <IdentityShell title={messages.agreements.title} width="wide">
      <AgreementList
        agreements={agreements}
        locale={locale}
        messages={messages}
        partyNames={partyNames}
      />
    </IdentityShell>
  );
}
