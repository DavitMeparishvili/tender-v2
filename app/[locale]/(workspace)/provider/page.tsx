import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireCapability } from "@/src/modules/identity/application/require-capability";
import {
  WorkspaceDenied,
  WorkspaceView,
} from "@/src/modules/identity/ui/workspace-view";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { HomeAiChat } from "@/src/modules/shell/ui/home-ai-chat";

export default async function ProviderWorkspacePage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const [{ locale }, requestHeaders] = await Promise.all([params, headers()]);
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const access = await requireCapability(requestHeaders, "PROVIDER");
  if (!access.ok) {
    if (access.error === "UNAUTHENTICATED") {
      redirect("/" + locale + "/login");
    }
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
  return (
    <>
      <WorkspaceView
        active="PROVIDER"
        locale={locale}
        messages={messages}
        user={access.value}
      />
      <HomeAiChat locale={locale} />
    </>
  );
}
