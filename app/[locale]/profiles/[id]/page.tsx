import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/src/modules/identity/application/current-user";
import {
  getProfileContact,
  type ProfileContact,
} from "@/src/modules/profiles/application/get-profile-contact";
import { getPublicProfile } from "@/src/modules/profiles/application/get-public-profile";
import { isVerifiedProvider } from "@/src/modules/profiles/domain/profile";
import { getProfileReviews } from "@/src/modules/reviews/application/get-profile-reviews";
import { ReviewList } from "@/src/modules/reviews/ui/review-list";
import { ReviewSummary, Stars } from "@/src/modules/reviews/ui/review-summary";
import { isLocale } from "@/src/modules/localization/config";
import {
  getMessages,
  type Messages,
} from "@/src/modules/localization/get-messages";
import { getProviderRecord } from "@/src/modules/shell/application/provider-record";
import { BrandIcon } from "@/src/modules/shell/ui/brand-icon";
import { formatTenderDate } from "@/src/modules/tenders/ui/tender-format";
import { isTenderServiceCode } from "@/src/modules/tenders/domain/service-taxonomy";
import {
  serviceLabel,
  specialtyLabel,
} from "@/src/modules/tenders/ui/tender-taxonomy";
import { getActiveVipMembership } from "@/src/modules/vip/application/vip-membership";
import { VipBadge } from "@/src/modules/vip/ui/vip-badge";

/** Counts per whole-star bucket, index 0 = 1★, so the histogram is real. */
function histogramOf(overalls: readonly number[]): readonly number[] {
  const buckets = [0, 0, 0, 0, 0];
  for (const overall of overalls) {
    const star = Math.min(5, Math.max(1, Math.round(overall)));
    buckets[star - 1] = (buckets[star - 1] ?? 0) + 1;
  }
  return buckets;
}

function ProfileContacts({
  contact,
  copy,
}: Readonly<{
  contact: ProfileContact | null;
  copy: Messages["providerProfile"];
}>) {
  if (contact === null) {
    return (
      <p className="profile-contacts-hidden">
        <BrandIcon name="secure" size={16} />
        {copy.contactsHidden}
      </p>
    );
  }
  return (
    <dl aria-label={copy.contactsTitle} className="profile-contacts">
      <div>
        <dt>{copy.contactEmail}</dt>
        <dd>
          <a href={`mailto:${contact.email}`}>{contact.email}</a>
        </dd>
      </div>
      <div>
        <dt>{copy.contactPhone}</dt>
        <dd>
          <a href={`tel:${contact.phoneE164}`}>{contact.phoneE164}</a>
        </dd>
      </div>
    </dl>
  );
}

export default async function PublicProfilePage({
  params,
}: Readonly<{ params: Promise<{ locale: string; id: string }> }>) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();

  const [profile, reviewOutput, record, viewer, membership] = await Promise.all(
    [
      getPublicProfile(id),
      getProfileReviews(id),
      getProviderRecord(id),
      headers().then(getCurrentUser),
      getActiveVipMembership(id),
    ],
  );
  if (!profile.ok) notFound();
  const contact = await getProfileContact(id, viewer);

  const messages = getMessages(locale);
  const copy = messages.providerProfile;
  const provider = profile.value;
  const isProvider = provider.providerSpecialties.length > 0;
  const isVerified = isVerifiedProvider({
    emailVerified: record.verifications.email,
    onboardingComplete: record.verifications.profile,
  });
  const overall = reviewOutput.aggregate.overall;
  const histogram = histogramOf(
    reviewOutput.reviews.map((review) => review.overall),
  );

  const verifications = [
    { met: record.verifications.email, label: copy.verificationEmail },
    { met: record.verifications.phone, label: copy.verificationPhone },
    { met: record.verifications.profile, label: copy.verificationProfile },
  ];

  return (
    <>
      {/* --------------------------------------------------- Header band */}
      <section className="band profile-band">
        <div className="motif grid-bg grid-bg--fade-b" />
        <div className="band-inner">
          <Link className="back-link" href={`/${locale}/provider/tenders`}>
            {messages.nav.discover}
          </Link>

          <div className="profile-head">
            <span className="profile-avatar">
              {membership?.logoPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  className="profile-avatar-logo"
                  src={membership.logoPath}
                />
              ) : (
                <BrandIcon name="buildings" size={38} />
              )}
            </span>

            <div className="profile-identity">
              <div className="profile-name-row">
                <h1>{provider.displayName}</h1>
                {membership === null ? null : (
                  <VipBadge label={messages.vip.badgeLabel} />
                )}
                {isVerified ? (
                  <span className="tag tag-green">
                    {isProvider
                      ? copy.verifiedProvider
                      : messages.common.verified}
                  </span>
                ) : null}
              </div>
              <p className="profile-descriptor">
                {provider.activityDescription}
              </p>
              {membership === null ? null : (
                <p className="vip-disclosure">{messages.vip.disclosure}</p>
              )}
              <p className="profile-meta">
                <span>
                  <span aria-hidden="true" className="dot-marker" />
                  {provider.city}
                </span>
                <span>
                  {provider.accountKind === "COMPANY"
                    ? copy.company
                    : copy.person}
                </span>
                {record.memberSince === null ? null : (
                  <span>
                    {messages.detail.memberSince}{" "}
                    {formatTenderDate(record.memberSince, locale)}
                  </span>
                )}
              </p>
              <ProfileContacts contact={contact} copy={copy} />
            </div>

            {isProvider ? (
              <div className="profile-actions">
                <Link
                  className="pill pill-brand"
                  href={`/${locale}/client/tenders/new`}
                >
                  {messages.nav.postTender}
                </Link>
                <p className="profile-actions-note">{copy.inviteNote}</p>
              </div>
            ) : null}
          </div>

          <dl className="profile-stats">
            <div>
              {overall === null ? (
                <p className="stat-value">—</p>
              ) : (
                <p className="profile-rating-row">
                  <span className="stat-value">{overall.toFixed(1)}</span>
                  <Stars score={overall} />
                </p>
              )}
              <dt className="stat-label">
                {copy.jobBound.replace(
                  "{count}",
                  String(reviewOutput.aggregate.reviewCount),
                )}
              </dt>
              <dd className="skip-link">
                {copy.ratingLabel
                  .replace("{score}", overall?.toFixed(1) ?? "—")
                  .replace(
                    "{count}",
                    String(reviewOutput.aggregate.reviewCount),
                  )}
              </dd>
            </div>
            <div>
              <dd className="stat-value">{record.completedEngagements}</dd>
              <dt className="stat-label">
                {messages.detail.completedEngagements}
              </dt>
            </div>
            {isProvider ? (
              <>
                <div>
                  <dd className="stat-value">{record.tendersWon}</dd>
                  <dt className="stat-label">
                    {messages.bidding.statusWinner}
                  </dt>
                </div>
                <div>
                  <dd className="stat-value">
                    {record.winRate === null ? "—" : `${record.winRate}%`}
                  </dd>
                  <dt className="stat-label">{copy.biddingRecord}</dt>
                </div>
              </>
            ) : null}
          </dl>
        </div>
      </section>

      {/* --------------------------------------------------------- Body */}
      <div className="band band-grey">
        <div className="band-inner profile-layout">
          <div className="detail-main">
            <section className="surface surface-2xl surface-pad">
              <h2 className="card-title">
                {isProvider ? copy.about : messages.detail.aboutClient}
              </h2>
              <p className="detail-prose">{provider.activityDescription}</p>
              {isProvider ? (
                <>
                  <h3 className="uppercase-label">{copy.services}</h3>
                  {record.serviceCounts.length > 0 ? (
                    <div className="chip-row">
                      {record.serviceCounts.map((entry) =>
                        isTenderServiceCode(entry.serviceCode) ? (
                          <span className="chip" key={entry.serviceCode}>
                            {serviceLabel(entry.serviceCode, messages)}
                            <span className="chip-count">{entry.count}</span>
                          </span>
                        ) : null,
                      )}
                    </div>
                  ) : provider.providerSpecialties.length > 0 ? (
                    // No won tenders yet, so the categories the provider
                    // declared stand in for the services list.
                    <div className="chip-row">
                      {provider.providerSpecialties.map((specialty) => (
                        <span className="chip" key={specialty}>
                          {specialtyLabel(specialty, messages)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>

            {/*
              Photo uploads are not built yet, so these frames say so rather
              than showing stock imagery that would imply real work records.
            */}
            {isProvider ? (
              <section className="surface surface-2xl surface-pad">
                <div className="detail-head-row detail-head-row-split">
                  <h2 className="card-title">{copy.workPhotos}</h2>
                  <span className="muted">{copy.workPhotosNote}</span>
                </div>
                <ul className="photo-grid">
                  {[0, 1, 2, 3].map((slot) => (
                    <li className="photo-placeholder" key={slot}>
                      {copy.photoPlaceholder}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section
              aria-labelledby="reviews-heading"
              className="surface surface-2xl surface-pad"
            >
              <h2 className="card-title" id="reviews-heading">
                {copy.reviewsTitle}
              </h2>
              <ReviewSummary
                aggregate={reviewOutput.aggregate}
                copy={messages.reviews}
                histogram={histogram}
                profileCopy={copy}
              />
              <ReviewList
                copy={messages.reviews}
                locale={locale}
                profileCopy={copy}
                reviews={reviewOutput.reviews}
              />
              {reviewOutput.reviews.length === 0 ? null : (
                <p className="review-foot">
                  {copy.showingReviews
                    .replace("{shown}", String(reviewOutput.reviews.length))
                    .replace(
                      "{count}",
                      String(reviewOutput.aggregate.reviewCount),
                    )}
                </p>
              )}
            </section>
          </div>

          <aside className="detail-rail">
            {isProvider ? (
              <section aria-labelledby="record-heading" className="rail-card">
                <h2 className="rail-head" id="record-heading">
                  {copy.biddingRecord}
                </h2>
                <dl className="rail-rows">
                  <div>
                    <dt>{messages.detail.offersLabel}</dt>
                    <dd>{record.offersSubmitted}</dd>
                  </div>
                  <div>
                    <dt>{messages.bidding.statusWinner}</dt>
                    <dd>{record.tendersWon}</dd>
                  </div>
                  <div>
                    <dt>{messages.detail.completedEngagements}</dt>
                    <dd>{record.completedEngagements}</dd>
                  </div>
                </dl>
                <p className="rail-note">{messages.bidding.selectionRule}</p>
              </section>
            ) : null}

            <section aria-labelledby="verify-heading" className="rail-card">
              <h2 className="rail-head" id="verify-heading">
                {copy.verifications}
              </h2>
              <ul className="check-list">
                {verifications.map((item) => (
                  <li
                    className={item.met ? undefined : "is-unmet"}
                    key={item.label}
                  >
                    {item.met ? (
                      <BrandIcon name="check" size={16} />
                    ) : (
                      <span aria-hidden="true" className="check-box-empty" />
                    )}
                    <div>
                      <div className="check-title">{item.label}</div>
                      <div className="check-note">
                        {item.met
                          ? copy.verificationConfirmed
                          : copy.verificationPending}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="coverage-heading" className="rail-card">
              <h2 className="rail-head" id="coverage-heading">
                {isProvider ? copy.coverage : messages.onboarding.city}
              </h2>
              <div className="chip-row">
                <span className="chip chip-quiet">{provider.city}</span>
              </div>
            </section>

            {isProvider ? (
              <section aria-labelledby="profile-cta" className="rail-cta">
                <div className="motif grid-bg--light grid-bg--fade-b" />
                <div className="rail-cta-body">
                  <h2 id="profile-cta">{copy.ctaTitle}</h2>
                  <p>{copy.ctaBody}</p>
                  <Link
                    className="pill pill-brand"
                    href={`/${locale}/client/tenders/new`}
                  >
                    {messages.nav.postTender}
                  </Link>
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </>
  );
}
