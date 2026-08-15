import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireCapability } from "@/src/modules/identity/application/require-capability";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { TenderWizard } from "@/src/modules/tenders/ui/tender-wizard";

export default async function NewTenderPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const [{ locale }, requestHeaders] = await Promise.all([params, headers()]);
  if (!isLocale(locale)) notFound();
  const access = await requireCapability(requestHeaders, "CUSTOMER");
  if (!access.ok) redirect("/" + locale + "/login");
  return <TenderWizard locale={locale} messages={getMessages(locale)} />;
}
