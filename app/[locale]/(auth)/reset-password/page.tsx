import { notFound } from "next/navigation";
import { ResetPasswordForm } from "@/src/modules/identity/ui/auth-forms";
import {
  AuthState,
  type AuthStateKind,
} from "@/src/modules/identity/ui/auth-state";
import { IdentityShell } from "@/src/modules/identity/ui/identity-shell";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function outcome(error: string): AuthStateKind {
  const normalized = error.toLowerCase();
  if (normalized.includes("expired")) return "expired";
  if (normalized.includes("used")) return "reused";
  return "invalid";
}

export default async function ResetPasswordPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const token = first(query.token);
  const error = first(query.error);
  const state = error ? outcome(error) : token ? null : "invalid";

  if (state !== null) {
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
      <IdentityShell title={messages.auth.resetTitle}>
        <AuthState
          state={state}
          title={copy.title}
          body={copy.body}
          action={{
            href: "/" + locale + "/forgot-password",
            label: messages.auth.sendResetLink,
          }}
        />
      </IdentityShell>
    );
  }

  if (token === undefined) notFound();

  return (
    <IdentityShell
      title={messages.auth.resetTitle}
      subtitle={messages.auth.resetSubtitle}
    >
      <ResetPasswordForm locale={locale} messages={messages} token={token} />
    </IdentityShell>
  );
}
