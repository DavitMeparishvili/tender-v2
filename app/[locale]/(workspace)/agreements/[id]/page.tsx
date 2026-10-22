import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAgreement } from "@/src/modules/agreements/application/get-agreement";
import { AgreementDetail } from "@/src/modules/agreements/ui/agreement-detail";
import { requireAnyCommercialCapability } from "@/src/modules/identity/application/require-capability";
import { IdentityShell } from "@/src/modules/identity/ui/identity-shell";
import { WorkspaceDenied } from "@/src/modules/identity/ui/workspace-view";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { getProviderDisplayNames } from "@/src/modules/profiles/application/get-provider-display-names";
import { getAgreementReview } from "@/src/modules/reviews/application/get-agreement-review";
import { HomeAiChat } from "@/src/modules/shell/ui/home-ai-chat";

export default async function AgreementPage({
  params,
}: Readonly<{ params: Promise<{ locale: string; id: string }> }>) {
  const [{ locale, id }, requestHeaders] = await Promise.all([
    params,
    headers(),
  ]);
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const access = await requireAnyCommercialCapability(requestHeaders);
  if (!access.ok) {
    if (access.error === "UNAUTHENTICATED") redirect(`/${locale}/login`);
    return (
      <>
        <WorkspaceDenied
          error={access.error}
          locale={locale}
          messages={messages}
        />
        <HomeAiChat locale={locale} />
      </>
    );
  }
  const agreement = await getAgreement(id, access.value);
  if (!agreement.ok) notFound();
  const [existingReview, partyNames] = await Promise.all([
    agreement.value.canReview
      ? getAgreementReview(id, access.value)
      : Promise.resolve(null),
    getProviderDisplayNames([
      agreement.value.clientId,
      agreement.value.providerId,
    ]),
  ]);
  return (
    <>
      <IdentityShell title={messages.agreements.detailTitle} width="form">
        <AgreementDetail
          agreement={agreement.value}
          hasPublishedReview={existingReview !== null}
          locale={locale}
          messages={messages}
          partyNames={partyNames}
        />
      </IdentityShell>
      <HomeAiChat locale={locale} />
    </>
  );
}
