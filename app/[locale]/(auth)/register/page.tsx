import Link from "next/link";
import { notFound } from "next/navigation";
import { IdentityShell } from "@/src/modules/identity/ui/identity-shell";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { HomeAiChat } from "@/src/modules/shell/ui/home-ai-chat";

export default async function RegisterIntentPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);

  return (
    <>
      <IdentityShell
        title={messages.auth.registerTitle}
        subtitle={messages.auth.registerSubtitle}
      >
        <div className="intent-list">
          <Link
            className="intent-option"
            href={"/" + locale + "/register/client"}
          >
            <span>{messages.auth.clientTitle}</span>
            <small>{messages.auth.clientDescription}</small>
          </Link>
          <Link
            className="intent-option"
            href={"/" + locale + "/register/provider"}
          >
            <span>{messages.auth.providerTitle}</span>
            <small>{messages.auth.providerDescription}</small>
          </Link>
        </div>
        <p className="supporting-note">{messages.auth.notPermanent}</p>
      </IdentityShell>
      <HomeAiChat locale={locale} />
    </>
  );
}
