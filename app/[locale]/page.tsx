import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { IdentityShell } from "@/src/modules/identity/ui/identity-shell";

export default async function LocaleHome({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const messages = getMessages(locale);

  return (
    <IdentityShell
      title={messages.auth.homeTitle}
      subtitle={messages.auth.homeSubtitle}
    >
      <div className="action-stack">
        <Link className="button button-primary" href={`/${locale}/register`}>
          {messages.auth.register}
        </Link>
        <Link className="button button-secondary" href={`/${locale}/login`}>
          {messages.auth.signIn}
        </Link>
      </div>
      <p className="supporting-note">{messages.auth.verificationRequired}</p>
    </IdentityShell>
  );
}
