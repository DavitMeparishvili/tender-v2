import { notFound } from "next/navigation";
import { RegistrationForm } from "@/src/modules/identity/ui/auth-forms";
import { IdentityShell } from "@/src/modules/identity/ui/identity-shell";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";

export default async function ClientRegistrationPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);

  return (
    <IdentityShell
      title={messages.auth.clientTitle}
      subtitle={messages.auth.verificationRequired}
      progress={{
        current: 1,
        labels: [
          messages.onboarding.accountStep,
          messages.onboarding.verificationStep,
          messages.onboarding.profileStep,
        ],
      }}
    >
      <RegistrationForm locale={locale} messages={messages} intent="CLIENT" />
    </IdentityShell>
  );
}
