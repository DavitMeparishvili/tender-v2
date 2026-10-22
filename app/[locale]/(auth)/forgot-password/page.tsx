import { notFound } from "next/navigation";
import { ForgotPasswordForm } from "@/src/modules/identity/ui/auth-forms";
import { IdentityShell } from "@/src/modules/identity/ui/identity-shell";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { HomeAiChat } from "@/src/modules/shell/ui/home-ai-chat";

export default async function ForgotPasswordPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);

  return (
    <>
      <IdentityShell
        title={messages.auth.forgotTitle}
        subtitle={messages.auth.forgotSubtitle}
      >
        <ForgotPasswordForm locale={locale} messages={messages} />
      </IdentityShell>
      <HomeAiChat locale={locale} />
    </>
  );
}
