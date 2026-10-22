import Link from "next/link";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import { BrandIcon } from "../../shell/ui/brand-icon";
import type { VipPartner } from "../domain/partner";
import { fillTemplate, pluralTemplate } from "../domain/plural-forms";
import { vipCategoryLabel } from "./vip-category-label";

/**
 * One All partners card (handoff section 4). The whole card is one link to the
 * partner's profile, so nothing inside it is a link of its own.
 */
export function VipPartnerCard({
  partner,
  locale,
  messages,
}: Readonly<{
  partner: VipPartner;
  locale: Locale;
  messages: Messages;
}>) {
  const copy = messages.vip;
  const completed = fillTemplate(
    pluralTemplate(copy.completed, partner.completed, locale),
    { n: new Intl.NumberFormat(locale).format(partner.completed) },
  );

  return (
    <li className="vip-grid-item">
      <Link
        className="vip-partner-card"
        href={`/${locale}/profiles/${partner.userId}`}
      >
        <span className="vip-partner-top">
          {partner.logoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              className="vip-partner-logo"
              height={52}
              loading="lazy"
              src={partner.logoPath}
              width={52}
            />
          ) : (
            <span
              aria-hidden="true"
              className="vip-partner-logo vip-partner-logo-fallback"
            >
              <BrandIcon name="buildings" size={22} />
            </span>
          )}
          <span className="vip-partner-id">
            <span className="vip-partner-name">
              <span className="vip-partner-name-text">{partner.name}</span>
              {partner.verified ? (
                <>
                  <svg
                    aria-hidden="true"
                    className="vip-partner-verified"
                    height="14"
                    viewBox="0 0 16 16"
                    width="14"
                  >
                    <circle cx="8" cy="8" fill="#059669" r="8" />
                    <path
                      d="M4.6 8.3 L7 10.6 L11.4 5.8"
                      fill="none"
                      stroke="#fff"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                  <span className="skip-link">
                    {messages.providerProfile.verifiedProvider}
                  </span>
                </>
              ) : null}
            </span>
            <span className="vip-partner-service">{partner.serviceLabel}</span>
          </span>
        </span>

        <span className="vip-partner-meta">
          {partner.specialty ? (
            <span
              className="vip-partner-tag"
              title={vipCategoryLabel(partner.specialty, messages)}
            >
              {vipCategoryLabel(partner.specialty, messages)}
            </span>
          ) : null}
          {partner.city ? (
            <span className="vip-partner-city">
              <svg
                aria-hidden="true"
                height="13"
                viewBox="0 0 16 16"
                width="13"
              >
                <path
                  d="M8 15s5-4.6 5-8.5A5 5 0 0 0 3 6.5C3 10.4 8 15 8 15z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <circle cx="8" cy="6.5" fill="currentColor" r="1.8" />
              </svg>
              {partner.city}
            </span>
          ) : null}
        </span>

        {partner.description ? (
          <span className="vip-partner-desc">{partner.description}</span>
        ) : null}

        <span className="vip-partner-foot">
          {partner.rating !== null ? (
            <span className="vip-partner-rating">
              <svg
                aria-hidden="true"
                height="12"
                viewBox="0 0 20 20"
                width="12"
              >
                <path
                  d="M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3.1-5.4 3.1 1.2-6L1.3 7.8l6.1-.7z"
                  fill="#D9A441"
                />
              </svg>
              <span className="vip-partner-score">
                {new Intl.NumberFormat(locale, {
                  maximumFractionDigits: 1,
                  minimumFractionDigits: 1,
                }).format(partner.rating)}
              </span>
            </span>
          ) : null}
          <span className="vip-partner-completed">{completed}</span>
          <span className="vip-partner-cta">
            {copy.viewProfile}
            <svg aria-hidden="true" height="14" viewBox="0 0 16 16" width="14">
              <path
                d="M6 3 L11 8 L6 13"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          </span>
        </span>
      </Link>
    </li>
  );
}
