import { notFound } from "next/navigation";
import { VerificationActions } from "@/src/modules/identity/ui/auth-forms";
import {
  AuthState,
  type AuthStateKind,
} from "@/src/modules/identity/ui/auth-state";
import { IdentityShell } from "@/src/modules/identity/ui/identity-shell";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { HomeAiChat } from "@/src/modules/shell/ui/home-ai-chat";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function outcome(error: string): AuthStateKind {
  const normalized = error.toLowerCase();
  if (normalized.includes("expired")) return "expired";
  if (normalized.includes("used")) return "reused";
  return "invalid";
}

export default async function VerifyEmailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const error = first(query.error);
  const status = first(query.status);
  const email = first(query.email) ?? "";

  if (status === "success") {
    return (
      <>
        <IdentityShell title={messages.auth.verificationTitle}>
          <AuthState
            state="success"
            title={messages.auth.verificationSuccessTitle}
            body={messages.auth.verificationSuccessBody}
            action={{
              href: "/" + locale + "/continue",
              label: messages.common.continue,
            }}
          />
        </IdentityShell>
        <HomeAiChat locale={locale} />
      </>
    );
  }

  if (error) {
    const state = outcome(error);
    const copy =
      state === "expired"
        ? {
            title: messages.auth.expiredLinkTitle,
            body: messages.auth.expiredLinkBody,
          }
        : state === "reused"
          ? {
              title: messages.auth.reusedLinkTitle,
              body: messages.auth.reusedLinkBody,
            }
          : {
              title: messages.auth.invalidLinkTitle,
              body: messages.auth.invalidLinkBody,
            };
    return (
      <>
        <IdentityShell title={messages.auth.verificationTitle}>
          <AuthState
            state={state}
            title={copy.title}
            body={copy.body}
            action={{
              href: "/" + locale + "/register",
              label: messages.auth.register,
            }}
            secondaryAction={{
              href: "/" + locale + "/login",
              label: messages.auth.signIn,
            }}
          />
        </IdentityShell>
        <HomeAiChat locale={locale} />
      </>
    );
  }

  return (
    <>
      <IdentityShell
        title={messages.auth.verificationSentTitle}
        subtitle={messages.auth.verificationSentBody.replace(
          "{email}",
          email || messages.auth.email.toLowerCase(),
        )}
        progress={{
          current: 2,
          labels: [
            messages.onboarding.accountStep,
            messages.onboarding.verificationStep,
            messages.onboarding.profileStep,
          ],
        }}
      >
        <VerificationActions
          locale={locale}
          messages={messages}
          email={email}
        />
      </IdentityShell>
      <HomeAiChat locale={locale} />
    </>
  );
}
