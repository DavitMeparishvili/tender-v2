import Link from "next/link";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import type { BidSummary } from "../../bidding/domain/bid-summary";
import type { PublicTenderSummary } from "../../tenders/domain/masking";
import { TENDER_SPECIALTIES } from "../../tenders/domain/service-taxonomy";
import {
  formatTenderDate,
  formatTenderMoney,
} from "../../tenders/ui/tender-format";
import { serviceLabel, specialtyLabel } from "../../tenders/ui/tender-taxonomy";
import { specialtyIcon, specialtyTone } from "../../tenders/ui/tender-tone";
import type {
  LandingReview,
  MarketplaceOverview,
} from "../application/marketplace-overview";
import { BrandIcon } from "./brand-icon";
import { DeadlineCountdown } from "./deadline-countdown";

export type LandingData = Readonly<{
  overview: MarketplaceOverview;
  tenders: readonly PublicTenderSummary[];
  summaries: ReadonlyMap<string, BidSummary>;
  reviews: readonly LandingReview[];
}>;

function Stars({ score }: Readonly<{ score: number }>) {
  const filled = Math.round(score);
  return (
    <span aria-hidden="true" className="stars">
      {"★".repeat(filled)}
      {"☆".repeat(Math.max(0, 5 - filled))}
    </span>
  );
}

function count(locale: Locale, value: number): string {
  return new Intl.NumberFormat(locale).format(value);
}

function Figure({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <div className="figure-label">{label}</div>
      <div className="figure-value">{value}</div>
    </div>
  );
}

export function LandingPage({
  data,
  locale,
  messages,
}: Readonly<{ data: LandingData; locale: Locale; messages: Messages }>) {
  const at = (path: string) => `/${locale}${path}`;
  const copy = messages.landing;
  const featured = data.tenders.slice(0, 3);
  const [preview] = data.tenders;
  const previewSummary =
    preview === undefined ? undefined : data.summaries.get(preview.id);

  const openTenderLabel = count(locale, data.overview.openTenders);

  const stats = [
    {
      label: copy.statOpenTenders,
      value: count(locale, data.overview.openTenders),
    },
    {
      label: copy.statProviders,
      value: count(locale, data.overview.verifiedProviders),
    },
    {
      label: copy.statOffers,
      value: count(locale, data.overview.offersReceived),
    },
    {
      label: copy.statCompleted,
      value: count(locale, data.overview.completedEngagements),
    },
  ];

  const popular = TENDER_SPECIALTIES.slice(0, 4);

  return (
    <>
      {/* ---------------------------------------------------------- Hero */}
      <section className="band hero">
        <div className="band-inner">
          <div>
            <p className="overline">{copy.overline}</p>
            <h1>{copy.title}</h1>
            <p className="hero-lead">{copy.lead}</p>

            <form action={at("/provider/tenders")} className="search-bar">
              <BrandIcon name="magnify" opacity={0.5} size={18} />
              <label className="skip-link" htmlFor="landing-keyword">
                {copy.searchLabel}
              </label>
              <input
                id="landing-keyword"
                name="city"
                placeholder={copy.searchPlaceholder}
                type="search"
              />
              <span aria-hidden="true" className="search-divider" />
              <select
                aria-label={messages.tenders.filterSpecialty}
                defaultValue=""
                name="specialty"
              >
                <option value="">{copy.allCategories}</option>
                {TENDER_SPECIALTIES.map((specialty) => (
                  <option key={specialty} value={specialty}>
                    {specialtyLabel(specialty, messages)}
                  </option>
                ))}
              </select>
              <button type="submit">{copy.search}</button>
            </form>

            <div className="hero-popular">
              <span>{copy.popular}</span>
              {popular.map((specialty) => (
                <Link
                  className="chip"
                  href={`${at("/provider/tenders")}?specialty=${specialty}`}
                  key={specialty}
                >
                  {specialtyLabel(specialty, messages)}
                </Link>
              ))}
            </div>

            <dl className="hero-stats">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dd className="stat-value">{stat.value}</dd>
                  <dt className="stat-label">{stat.label}</dt>
                </div>
              ))}
            </dl>
          </div>

          {/* The preview is the newest real open tender, not a mock-up. */}
          <div className="hero-preview">
            <article className="hero-preview-card">
              {preview === undefined ? (
                <>
                  <span className="tag tag-grey">{copy.previewHeading}</span>
                  <p className="hero-preview-title">{copy.previewEmpty}</p>
                  <p className="note-row">{copy.noOpenTenders}</p>
                </>
              ) : (
                <>
                  <div className="hero-preview-head">
                    <span className="tag tag-emerald">
                      {copy.previewStatus}
                    </span>
                    <DeadlineCountdown
                      closedLabel={messages.discovery.closed}
                      deadline={preview.deadline}
                      locale={locale}
                      messages={messages}
                      template={copy.closesIn}
                    />
                  </div>
                  <h2 className="hero-preview-title">
                    <Link href={at(`/provider/tenders/${preview.id}`)}>
                      {preview.title}
                    </Link>
                  </h2>
                  <p className="hero-preview-meta">
                    {[
                      preview.city,
                      specialtyLabel(preview.specialty, messages),
                      serviceLabel(preview.serviceCode, messages),
                    ].join(" · ")}
                  </p>
                  <dl className="hero-preview-figures">
                    <Figure
                      label={copy.previewBudget}
                      value={
                        formatTenderMoney(
                          preview.budgetMinorUnits,
                          preview.currency,
                          locale,
                        ) ?? messages.tenders.notProvided
                      }
                    />
                    <Figure
                      label={copy.previewOffers}
                      value={count(locale, previewSummary?.bidCount ?? 0)}
                    />
                    <Figure
                      label={copy.previewLowest}
                      value={
                        formatTenderMoney(
                          previewSummary?.lowestAmountMinorUnits ?? null,
                          preview.currency,
                          locale,
                        ) ?? messages.discovery.noOffers
                      }
                    />
                  </dl>
                  <p className="note-row">
                    <BrandIcon name="shield" opacity={0.55} size={15} />
                    {copy.previewFoot}
                  </p>
                </>
              )}
            </article>
            <div aria-hidden="true" className="hero-toast">
              <span className="hero-toast-dot">
                <span />
              </span>
              <div>
                <div className="hero-toast-title">
                  {count(locale, data.overview.offersReceived)}
                </div>
                <div className="hero-toast-meta">{copy.statOffers}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- Open tenders */}
      <section className="band band-white" id="open-tenders">
        <div className="band-inner band-pad">
          <div className="section-head">
            <div>
              <p className="overline">{copy.liveNow}</p>
              <h2 className="section-title">{copy.openTendersTitle}</h2>
            </div>
            <Link className="pill pill-outline" href={at("/provider/tenders")}>
              {`${copy.browseAll} (${openTenderLabel})`}
            </Link>
          </div>

          {featured.length === 0 ? (
            <div className="tender-empty">
              <p>{copy.noOpenTenders}</p>
            </div>
          ) : (
            <ul className="tender-card-grid">
              {featured.map((tender) => {
                const summary = data.summaries.get(tender.id);
                return (
                  <li key={tender.id}>
                    <article className="tender-card">
                      <div className="tender-card-head">
                        <span className={specialtyTone(tender.specialty)}>
                          {specialtyLabel(tender.specialty, messages)}
                        </span>
                        <DeadlineCountdown
                          closedLabel={messages.discovery.closed}
                          deadline={tender.deadline}
                          locale={locale}
                          messages={messages}
                          template={copy.closesIn}
                        />
                      </div>
                      <h3 className="tender-card-title">
                        <Link href={at(`/provider/tenders/${tender.id}`)}>
                          {tender.title}
                        </Link>
                      </h3>
                      <p className="tender-card-meta">
                        {[
                          tender.city,
                          serviceLabel(tender.serviceCode, messages),
                        ].join(" · ")}
                      </p>
                      <dl className="tender-card-figures">
                        <Figure
                          label={messages.tenders.budget}
                          value={
                            formatTenderMoney(
                              tender.budgetMinorUnits,
                              tender.currency,
                              locale,
                            ) ?? messages.tenders.notProvided
                          }
                        />
                        <Figure
                          label={copy.previewOffers}
                          value={count(locale, summary?.bidCount ?? 0)}
                        />
                        <Figure
                          label={copy.previewLowest}
                          value={
                            formatTenderMoney(
                              summary?.lowestAmountMinorUnits ?? null,
                              tender.currency,
                              locale,
                            ) ?? "—"
                          }
                        />
                      </dl>
                      <p className="note-row note-dashed">
                        <BrandIcon name="secure" opacity={0.5} size={14} />
                        {copy.privacyNote}
                      </p>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* --------------------------------------------------- Categories */}
      <section className="band band-grey" id="categories">
        <div className="motif grid-bg grid-bg--fade-radial" />
        <div className="band-inner band-pad">
          <p className="overline">{copy.categoriesOverline}</p>
          <h2 className="section-title section-title-gap">
            {copy.categoriesTitle}
          </h2>
          <ul className="category-grid">
            {TENDER_SPECIALTIES.map((specialty) => (
              <li key={specialty}>
                <Link
                  className="category-tile"
                  href={`${at("/provider/tenders")}?specialty=${specialty}`}
                >
                  <span className="icon-chip">
                    <BrandIcon name={specialtyIcon(specialty)} size={22} />
                  </span>
                  <span>
                    <span className="category-name">
                      {specialtyLabel(specialty, messages)}
                    </span>
                    <span className="category-count">
                      {copy.openTenderCount.replace(
                        "{count}",
                        count(
                          locale,
                          data.overview.openBySpecialty.get(specialty) ?? 0,
                        ),
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
            <li>
              <Link
                className="category-tile category-tile-ink"
                href={at("/provider/tenders")}
              >
                <span aria-hidden="true" className="icon-chip">
                  →
                </span>
                <span>
                  <span className="category-name">{copy.allCategories}</span>
                  <span className="category-count">
                    {copy.categoriesListed.replace(
                      "{count}",
                      count(locale, TENDER_SPECIALTIES.length),
                    )}
                  </span>
                </span>
              </Link>
            </li>
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------- How it works */}
      <section className="band band-white" id="how-it-works">
        <div className="band-inner band-pad">
          <p className="overline">{copy.howOverline}</p>
          <h2 className="section-title">{copy.howTitle}</h2>
          <p className="lede lede-measure">{copy.howLead}</p>
          <div className="lane-grid">
            <div className="lane">
              <h3 className="lane-head">
                <span className="lane-chip">
                  <BrandIcon name="buildings" size={18} />
                </span>
                <span>{copy.forClients}</span>
              </h3>
              <ol className="lane-steps">
                {[
                  [copy.clientStep1, copy.clientStep1Body],
                  [copy.clientStep2, copy.clientStep2Body],
                  [copy.clientStep3, copy.clientStep3Body],
                  [copy.clientStep4, copy.clientStep4Body],
                ].map(([title, body]) => (
                  <li key={title}>
                    <div>
                      <div className="lane-step-title">{title}</div>
                      <div className="lane-step-body">{body}</div>
                    </div>
                  </li>
                ))}
              </ol>
              <Link className="pill pill-brand" href={at("/register/client")}>
                {messages.nav.postTender}
              </Link>
            </div>

            <div className="lane lane-ink">
              <div className="motif grid-bg--light grid-bg--fade-b" />
              <h3 className="lane-head">
                <span className="lane-chip">
                  <BrandIcon name="handshake" onInk size={18} />
                </span>
                <span>{copy.forProviders}</span>
              </h3>
              <ol className="lane-steps">
                {[
                  [copy.providerStep1, copy.providerStep1Body],
                  [copy.providerStep2, copy.providerStep2Body],
                  [copy.providerStep3, copy.providerStep3Body],
                  [copy.providerStep4, copy.providerStep4Body],
                ].map(([title, body]) => (
                  <li key={title}>
                    <div>
                      <div className="lane-step-title">{title}</div>
                      <div className="lane-step-body">{body}</div>
                    </div>
                  </li>
                ))}
              </ol>
              <Link
                className="pill pill-on-ink"
                href={at("/register/provider")}
              >
                {copy.findWork}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- Trust */}
      <section className="band band-grey" id="trust">
        <div className="band-inner band-pad">
          <div className="trust-grid">
            <div>
              <p className="overline">{copy.trustOverline}</p>
              <h2 className="section-title section-title-gap-sm">
                {copy.trustTitle}
              </h2>
              <p className="lede lede-body">{copy.trustLead}</p>
            </div>
            <ul className="trust-cards">
              {(
                [
                  {
                    icon: "checklist",
                    title: copy.trust1,
                    body: copy.trust1Body,
                  },
                  { icon: "secure", title: copy.trust2, body: copy.trust2Body },
                  { icon: "clock", title: copy.trust3, body: copy.trust3Body },
                  { icon: "trophy", title: copy.trust4, body: copy.trust4Body },
                ] as const
              ).map((card) => (
                <li className="trust-card" key={card.title}>
                  <BrandIcon name={card.icon} size={24} />
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ Reviews */}
      <section className="band band-white" id="reviews">
        <div className="band-inner band-pad-sm">
          <div className="section-head">
            <h2 className="section-title section-title-sm">
              {copy.quotesTitle}
            </h2>
            <span className="muted">{copy.quotesNote}</span>
          </div>
          {data.reviews.length === 0 ? (
            <div className="tender-empty">
              <p>{copy.quotesEmpty}</p>
            </div>
          ) : (
            <ul className="quote-grid">
              {data.reviews.map((review) => (
                <li className="quote-card" key={review.id}>
                  <Stars score={review.overall} />
                  <span className="skip-link">
                    {messages.providerProfile.ratingLabel
                      .replace("{score}", review.overall.toFixed(1))
                      .replace("{count}", "1")}
                  </span>
                  <blockquote>{review.comment}</blockquote>
                  <div className="quote-attrib">{review.tenderTitle}</div>
                  <div className="quote-verify">
                    {messages.providerProfile.verifiedCompletion} ·{" "}
                    {formatTenderDate(review.createdAt, locale)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------- CTA */}
      <section className="band band-brand cta-band" id="access">
        <div className="motif motif-dense grid-bg grid-bg--fade-b" />
        <div className="band-inner">
          <div>
            <h2>{copy.ctaTitle}</h2>
            <p>{copy.ctaBody}</p>
          </div>
          <div className="cta-actions">
            <Link className="pill pill-ink" href={at("/register/client")}>
              {messages.nav.postTender}
            </Link>
            <Link
              className="pill pill-on-brand"
              href={at("/register/provider")}
            >
              {copy.ctaBrowse}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
