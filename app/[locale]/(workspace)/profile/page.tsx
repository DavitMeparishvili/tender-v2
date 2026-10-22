import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/src/modules/identity/application/current-user";
import { IdentityShell } from "@/src/modules/identity/ui/identity-shell";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { getOwnProfile } from "@/src/modules/profiles/application/update-own-profile";
import { ProfileForm } from "@/src/modules/profiles/ui/profile-form";
import { HomeAiChat } from "@/src/modules/shell/ui/home-ai-chat";

export default async function ProfilePage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const [{ locale }, requestHeaders] = await Promise.all([params, headers()]);
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const user = await getCurrentUser(requestHeaders);
  if (user === null) redirect("/" + locale + "/login");
  if (!user.emailVerified || !user.onboardingComplete) {
    redirect("/" + locale + "/continue");
  }
  const result = await getOwnProfile({ id: user.id });
  if (!result.ok) redirect("/" + locale + "/continue");
  const workspace = user.capabilities.includes("CUSTOMER")
    ? "/" + locale + "/client"
    : "/" + locale + "/provider";

  return (
    <>
      <IdentityShell
        eyebrow={
          <Link className="back-link" href={workspace}>
            {messages.profile.backToWorkspace}
          </Link>
        }
        title={messages.profile.title}
        subtitle={messages.profile.subtitle}
        width="form"
      >
        <ProfileForm
          locale={locale}
          profile={result.value}
          messages={messages}
        />
      </IdentityShell>
      <HomeAiChat locale={locale} />
    </>
  );
}
