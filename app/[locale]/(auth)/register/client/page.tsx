import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/src/modules/identity/application/current-user";
import {
  RegistrationForm,
  VerificationActions,
} from "@/src/modules/identity/ui/auth-forms";
import { IdentityShell } from "@/src/modules/identity/ui/identity-shell";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { OnboardingForm } from "@/src/modules/profiles/ui/onboarding-form";
import { HomeAiChat } from "@/src/modules/shell/ui/home-ai-chat";

export default async function ClientRegistrationPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const user = await getCurrentUser(await headers());
  const step = user?.emailVerified ? 3 : user ? 2 : 1;
  const title =
    step === 3
      ? messages.onboarding.title
      : step === 2
        ? messages.auth.verificationSentTitle
        : messages.auth.clientTitle;
  const subtitle =
    step === 3
      ? messages.onboarding.clientSubtitle
      : step === 2
        ? messages.auth.verificationSentBody.replace("{email}", user!.email)
        : messages.auth.verificationRequired;

  return (
    <>
      <IdentityShell
        title={title}
        subtitle={subtitle}
        width={user === null ? "form" : "task"}
        progress={{
          current: step,
          labels: [
            messages.onboarding.accountStep,
            messages.onboarding.verificationStep,
            messages.onboarding.profileStep,
          ],
        }}
      >
        {user === null ? (
          <RegistrationForm
            locale={locale}
            messages={messages}
            intent="CLIENT"
          />
        ) : !user.emailVerified ? (
          <VerificationActions
            locale={locale}
            messages={messages}
            email={user.email}
          />
        ) : (
          <OnboardingForm locale={locale} messages={messages} intent="CLIENT" />
        )}
      </IdentityShell>
      <HomeAiChat locale={locale} />
    </>
  );
}
