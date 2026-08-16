import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireCapability } from "@/src/modules/identity/application/require-capability";
import { IdentityShell } from "@/src/modules/identity/ui/identity-shell";
import { WorkspaceDenied } from "@/src/modules/identity/ui/workspace-view";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { listReviewsForModeration } from "@/src/modules/reviews/application/list-reviews-for-moderation";
import { ReviewModerationList } from "@/src/modules/reviews/ui/review-moderation-list";

export default async function AdminReviewsPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const [{ locale }, requestHeaders] = await Promise.all([params, headers()]);
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const access = await requireCapability(requestHeaders, "ADMIN");
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
  return (
    <IdentityShell title={messages.moderation.title}>
      <ReviewModerationList
        reviews={await listReviewsForModeration()}
        copy={messages.moderation}
      />
    </IdentityShell>
  );
}
