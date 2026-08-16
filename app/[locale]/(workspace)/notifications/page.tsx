import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { listInbox } from "@/src/modules/notifications/application/list-inbox";
import { InboxList } from "@/src/modules/notifications/ui/inbox-list";
import { requireAnyCommercialCapability } from "@/src/modules/identity/application/require-capability";
import { IdentityShell } from "@/src/modules/identity/ui/identity-shell";
import { isLocale } from "@/src/modules/localization/config";

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const [{ locale }, requestHeaders] = await Promise.all([params, headers()]);
  if (!isLocale(locale)) notFound();
  const access = await requireAnyCommercialCapability(requestHeaders);
  if (!access.ok) { if (access.error === "UNAUTHENTICATED") redirect(`/${locale}/login`); notFound(); }
  return <IdentityShell title="Inbox"><InboxList locale={locale} items={await listInbox(access.value)} /></IdentityShell>;
}
