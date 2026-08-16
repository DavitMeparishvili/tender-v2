import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireAnyCommercialCapability } from "@/src/modules/identity/application/require-capability";
import { IdentityShell } from "@/src/modules/identity/ui/identity-shell";
import { WorkspaceDenied } from "@/src/modules/identity/ui/workspace-view";
import { getMessages } from "@/src/modules/localization/get-messages";
import { isLocale } from "@/src/modules/localization/config";
import { listInbox } from "@/src/modules/notifications/application/list-inbox";
import { InboxList } from "@/src/modules/notifications/ui/inbox-list";

export default async function NotificationsPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const [{ locale }, requestHeaders] = await Promise.all([params, headers()]);
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const access = await requireAnyCommercialCapability(requestHeaders);
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
  const items = await listInbox(access.value);
  return (
    <IdentityShell title={messages.notifications.title}>
      <InboxList
        items={items}
        locale={locale}
        messages={messages}
        userId={access.value.id}
      />
    </IdentityShell>
  );
}
