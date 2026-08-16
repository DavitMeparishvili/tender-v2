import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicProfile } from "@/src/modules/profiles/application/get-public-profile";
import { getProfileReviews } from "@/src/modules/reviews/application/get-profile-reviews";
import { ReviewList } from "@/src/modules/reviews/ui/review-list";
import { ReviewSummary, Stars } from "@/src/modules/reviews/ui/review-summary";
import { isLocale } from "@/src/modules/localization/config";
import { getMessages } from "@/src/modules/localization/get-messages";
import { getProviderRecord } from "@/src/modules/shell/application/provider-record";
import { BrandIcon } from "@/src/modules/shell/ui/brand-icon";
import { formatTenderDate } from "@/src/modules/tenders/ui/tender-format";
import { isTenderServiceCode } from "@/src/modules/tenders/domain/service-taxonomy";
import { serviceLabel } from "@/src/modules/tenders/ui/tender-taxonomy";

/** Counts per whole-star bucket, index 0 = 1★, so the histogram is real. */
function histogramOf(overalls: readonly number[]): readonly number[] {
  const buckets = [0, 0, 0, 0, 0];
  for (const overall of overalls) {
    const star = Math.min(5, Math.max(1, Math.round(overall)));
    buckets[star - 1] = (buckets[star - 1] ?? 0) + 1;
  }
  return buckets;
}

export default async function PublicProfilePage({
  params,
}: Readonly<{ params: Promise<{ locale: string; id: string }> }>) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();

  const [profile, reviewOutput, record] = await Promise.all([
    getPublicProfile(id),
    getProfileReviews(id),
    getProviderRecord(id),
  ]);
  if (!profile.ok) notFound();

  const messages = getMessages(locale);
  const copy = messages.providerProfile;
  const provider = profile.value;
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
            {copy.back}
          </Link>

          <div className="profile-head">
            <span className="profile-avatar">
              <BrandIcon name="buildings" size={38} />
            </span>

            <div className="profile-identity">
              <div className="profile-name-row">
                <h1>{provider.displayName}</h1>
                {record.verifications.email && record.verifications.profile ? (
                  <span className="tag tag-green">{copy.verifiedProvider}</span>
                ) : null}
              </div>
              <p className="profile-descriptor">
                {provider.activityDescription}
              </p>
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
            </div>

            <div className="profile-actions">
              <Link
                className="pill pill-brand"
                href={`/${locale}/client/tenders/new`}
              >
                {messages.nav.postTender}
              </Link>
              <p className="profile-actions-note">{copy.inviteNote}</p>
            </div>
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
            <div>
              <dd className="stat-value">{record.tendersWon}</dd>
              <dt className="stat-label">{messages.bidding.statusWinner}</dt>
            </div>
            <div>
              <dd className="stat-value">
                {record.winRate === null ? "—" : `${record.winRate}%`}
              </dd>
              <dt className="stat-label">{copy.biddingRecord}</dt>
            </div>
          </dl>
        </div>
      </section>

      {/* --------------------------------------------------------- Body */}
      <div className="band band-grey">
        <div className="band-inner profile-layout">
          <main className="detail-main">
            <section className="surface surface-2xl surface-pad">
              <h2 className="card-title">{copy.about}</h2>
              <p className="detail-prose">{provider.activityDescription}</p>
              <h3 className="uppercase-label">{copy.services}</h3>
              {record.serviceCounts.length === 0 ? (
                <p className="muted">{copy.noReviewsYet}</p>
              ) : (
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
              )}
            </section>

            {/*
              Photo uploads are not built yet, so these frames say so rather
              than showing stock imagery that would imply real work records.
            */}
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
          </main>

          <aside className="detail-rail">
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
              <p className="rail-note">{messages.bidding.automaticWinner}</p>
            </section>

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
                {copy.coverage}
              </h2>
              <div className="chip-row">
                <span className="chip chip-quiet">{provider.city}</span>
              </div>
            </section>

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
          </aside>
        </div>
      </div>
    </>
  );
}
