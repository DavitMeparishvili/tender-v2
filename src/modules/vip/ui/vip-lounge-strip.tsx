import Link from "next/link";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import { BrandIcon } from "../../shell/ui/brand-icon";
import type { LoungeStrip } from "../domain/lounge-strip";
import type { VipPartner } from "../domain/partner";
import { VipLoungeArrows } from "./vip-lounge-arrows";

const TITLE_ID = "vip-lounge-title";
const DISCLOSURE_ID = "vip-lounge-disclosure";
const SCROLLER_ID = "vip-lounge-scroller";

/**
 * The home page VIP Lounge strip (handoff section 3). Renders nothing when the
 * strip is hidden. Each chip is one link to the partner's public profile.
 */
export function VipLoungeStrip({
  lounge,
  locale,
  messages,
}: Readonly<{
  lounge: LoungeStrip<VipPartner>;
  locale: Locale;
  messages: Messages;
}>) {
  if (!lounge.visible) return null;

  const copy = messages.vip;

  return (
    <section aria-labelledby={TITLE_ID} className="vip-lounge">
      <div className="vip-lounge-body">
        <div className="vip-lounge-title-block">
          <h2 className="vip-lounge-title" id={TITLE_ID}>
            {copy.title}
          </h2>
          <p className="vip-lounge-note">
            <span
              aria-describedby={DISCLOSURE_ID}
              className="vip-lounge-note-text"
              title={copy.disclosure}
            >
              {copy.partnerListing}{" "}
              <span aria-hidden="true" className="vip-lounge-note-mark">
                ⓘ
              </span>
            </span>
            <span className="skip-link" id={DISCLOSURE_ID}>
              {copy.disclosure}
            </span>
          </p>
        </div>

        <ul className="vip-lounge-scroller" id={SCROLLER_ID}>
          {lounge.partners.map((partner) => (
            <li className="vip-lounge-item" key={partner.userId}>
              <Link
                className="vip-chip"
                href={`/${locale}/profiles/${partner.userId}`}
              >
                {partner.logoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    className="vip-chip-logo"
                    height={38}
                    loading="lazy"
                    src={partner.logoPath}
                    width={38}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="vip-chip-logo vip-chip-logo-fallback"
                  >
                    <BrandIcon name="buildings" size={18} />
                  </span>
                )}
                <span className="vip-chip-text">
                  <span className="vip-chip-name">
                    <span className="vip-chip-name-text">{partner.name}</span>
                    {partner.verified ? (
                      <>
                        <svg
                          aria-hidden="true"
                          className="vip-chip-verified"
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
                  <span className="vip-chip-service">
                    {partner.serviceLabel}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <VipLoungeArrows
          nextLabel={copy.nextPartners}
          previousLabel={copy.previousPartners}
          scrollerId={SCROLLER_ID}
          showArrows={lounge.showArrows}
        />

        <Link className="vip-lounge-all" href={`/${locale}/partners`}>
          {copy.allPartners}
        </Link>
      </div>
    </section>
  );
}
