import { notFound } from "next/navigation";
import { getPublicProfile } from "@/src/modules/profiles/application/get-public-profile";
import { getProfileReviews } from "@/src/modules/reviews/application/get-profile-reviews";
import { ReviewList } from "@/src/modules/reviews/ui/review-list";
import { ReviewSummary } from "@/src/modules/reviews/ui/review-summary";
import { IdentityShell } from "@/src/modules/identity/ui/identity-shell";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";

export default async function PublicProfilePage({
  params,
}: Readonly<{ params: Promise<{ locale: string; id: string }> }>) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const [profile, reviewOutput] = await Promise.all([
    getPublicProfile(id),
    getProfileReviews(id),
  ]);
  if (!profile.ok) notFound();
  const messages = getMessages(locale);
  return (
    <IdentityShell
      title={profile.value.displayName}
      subtitle={profile.value.activityDescription}
    >
      <dl className="tender-detail">
        <div>
          <dt>{messages.tenders.city}</dt>
          <dd>{profile.value.city}</dd>
        </div>
      </dl>
      <ReviewSummary
        aggregate={reviewOutput.aggregate}
        copy={messages.reviews}
      />
      <ReviewList
        reviews={reviewOutput.reviews}
        locale={locale}
        copy={messages.reviews}
      />
    </IdentityShell>
  );
}
