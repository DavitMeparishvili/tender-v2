import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAgreement } from "@/src/modules/agreements/application/get-agreement";
import { AgreementDetail } from "@/src/modules/agreements/ui/agreement-detail";
import { requireAnyCommercialCapability } from "@/src/modules/identity/application/require-capability";
import { IdentityShell } from "@/src/modules/identity/ui/identity-shell";
import { isLocale } from "@/src/modules/localization/config";

export default async function AgreementPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const [{ locale, id }, requestHeaders] = await Promise.all([params, headers()]);
  if (!isLocale(locale)) notFound();
  const access = await requireAnyCommercialCapability(requestHeaders);
  if (!access.ok) { if (access.error === "UNAUTHENTICATED") redirect(`/${locale}/login`); notFound(); }
  const agreement = await getAgreement(id, access.value);
  if (!agreement.ok) notFound();
  return <IdentityShell title="Agreement"><AgreementDetail agreement={agreement.value} /></IdentityShell>;
}
