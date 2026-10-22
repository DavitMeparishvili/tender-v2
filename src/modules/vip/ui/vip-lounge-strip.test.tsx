import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import en from "../../localization/messages/en.json";
import { selectLoungeStrip } from "../domain/lounge-strip";
import type { VipPartner } from "../domain/partner";
import { VipLoungeStrip } from "./vip-lounge-strip";

const messages = en as Messages;

function partner(
  userId: string,
  overrides: Partial<VipPartner> = {},
): VipPartner {
  return {
    userId,
    name: `Partner ${userId}`,
    city: "Tbilisi",
    specialty: "CONSTRUCTION_REPAIR",
    serviceLabel: "General contractor",
    description: null,
    logoPath: `/vip/logos/${userId}_icon.svg`,
    verified: true,
    rating: 4.5,
    completed: 3,
    ...overrides,
  };
}

function render(count: number, locale: Locale = "en") {
  const partners = Array.from({ length: count }, (_, index) =>
    partner(`partner-${index + 1}`),
  );
  return renderToStaticMarkup(
    <VipLoungeStrip
      lounge={selectLoungeStrip(partners)}
      locale={locale}
      messages={messages}
    />,
  );
}

describe("VipLoungeStrip", () => {
  it("renders nothing when fewer than 4 partners qualify", () => {
    for (const count of [0, 1, 2, 3]) {
      expect(render(count)).toBe("");
    }
  });

  it("renders each partner as one link to the profile in the current locale", () => {
    const html = render(4, "ka");

    for (let index = 1; index <= 4; index += 1) {
      expect(html).toContain(`href="/ka/profiles/partner-${index}"`);
    }
    // Chips are the only profile links in the strip: no nested links.
    expect(html.match(/<a /g)?.length).toBe(4 + 1);
  });

  it("uses an empty alt on the logo and keeps the partner name as link text", () => {
    const html = render(4);

    expect(html).toContain('alt=""');
    expect(html).toContain('src="/vip/logos/partner-1_icon.svg"');
    expect(html).toContain(
      '<span class="vip-chip-name-text">Partner partner-1</span>',
    );
    expect(html).toContain(
      '<span class="vip-chip-service">General contractor</span>',
    );
  });

  it("marks verified partners with the verified label", () => {
    const partners = [
      partner("verified-one"),
      partner("verified-two"),
      partner("unverified", { verified: false }),
      partner("verified-three"),
    ];
    const html = renderToStaticMarkup(
      <VipLoungeStrip
        lounge={selectLoungeStrip(partners)}
        locale="en"
        messages={messages}
      />,
    );

    expect(html.split(messages.providerProfile.verifiedProvider)).toHaveLength(
      4,
    );
  });

  it("falls back to a neutral icon when a partner has no logo", () => {
    const partners = Array.from({ length: 4 }, (_, index) =>
      partner(`no-logo-${index}`, { logoPath: null }),
    );
    const html = renderToStaticMarkup(
      <VipLoungeStrip
        lounge={selectLoungeStrip(partners)}
        locale="en"
        messages={messages}
      />,
    );

    expect(html).not.toContain('src="/vip/logos/');
    expect(html).toContain("vip-chip-logo-fallback");
  });

  it("shows the disclosure as the tooltip and as the accessible description", () => {
    const html = render(4);
    // React escapes the apostrophe in both attribute and text content.
    const escaped = messages.vip.disclosure.replaceAll("'", "&#x27;");

    expect(html).toContain(`title="${escaped}"`);
    expect(html).toContain('aria-describedby="vip-lounge-disclosure"');
    expect(html).toContain(
      `<span class="skip-link" id="vip-lounge-disclosure">${escaped}</span>`,
    );
  });

  it("links the All partners action to the partners page in the current locale", () => {
    const html = render(4, "ru");

    expect(html).toContain('href="/ru/partners"');
    expect(html).toContain(messages.vip.allPartners);
  });

  it("renders no arrows for 4 or 5 partners", () => {
    for (const count of [4, 5]) {
      const html = render(count);
      expect(html).not.toContain("vip-lounge-arrows");
      expect(html).not.toContain("<button");
    }
  });

  it("renders labelled previous and next arrows from 6 partners", () => {
    const html = render(6);

    expect(html).toContain('class="vip-lounge-arrows"');
    expect(html.match(/<button /g)?.length).toBe(2);
    expect(html).toContain(`aria-label="${messages.vip.previousPartners}"`);
    expect(html).toContain(`aria-label="${messages.vip.nextPartners}"`);
    expect(html).toContain('aria-controls="vip-lounge-scroller"');
  });

  it("caps the strip at 12 chips", () => {
    const html = render(15);

    expect(html.match(/class="vip-chip"/g)?.length).toBe(12);
    expect(html).toContain('href="/en/profiles/partner-12"');
    expect(html).not.toContain('href="/en/profiles/partner-13"');
  });
});
