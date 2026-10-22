import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import en from "../../localization/messages/en.json";
import ru from "../../localization/messages/ru.json";
import type { VipPartner, VipSpecialty } from "../domain/partner";
import {
  categoryOptions,
  type PartnerCategoryCounts,
} from "../domain/partners-page";
import { VipPartnersPage } from "./vip-partners-page";

const messagesByLocale: Readonly<Record<Locale, Messages>> = {
  en: en as Messages,
  ru: ru as Messages,
  ka: en as Messages,
};

const contactHref = "mailto:vip@tender-market.online";

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
    description: "Residential and commercial builds.",
    logoPath: `/vip/logos/${userId}_icon.svg`,
    verified: true,
    rating: 4.9,
    completed: 34,
    ...overrides,
  };
}

function counts(
  bySpecialty: Partial<Record<VipSpecialty, number>>,
): PartnerCategoryCounts {
  const full: Record<VipSpecialty, number> = {
    CONSTRUCTION_REPAIR: 0,
    TRANSPORT: 0,
    EQUIPMENT: 0,
    DAILY_LABOR: 0,
    MATERIAL_SUPPLIER: 0,
    ...bySpecialty,
  };
  const total = Object.values(full).reduce((sum, value) => sum + value, 0);
  return { total, bySpecialty: full };
}

function render({
  partners = [],
  selected = null,
  locale = "en",
  categoryCounts = counts({}),
}: {
  partners?: readonly VipPartner[];
  selected?: VipSpecialty | null;
  locale?: Locale;
  categoryCounts?: PartnerCategoryCounts;
} = {}) {
  return renderToStaticMarkup(
    <VipPartnersPage
      contactHref={contactHref}
      locale={locale}
      messages={messagesByLocale[locale]}
      options={categoryOptions(categoryCounts, selected)}
      partners={partners}
      selected={selected}
    />,
  );
}

/** The markup of every <li> inside the results grid, in order. */
function gridItems(html: string): string[] {
  const grid = html.slice(html.indexOf('<ul class="vip-grid"'));
  const body = grid.slice(0, grid.indexOf("</ul>"));
  return body.split("<li").slice(1);
}

/** The opening tag of the first element with this name. */
function tagOf(html: string, name: string): string {
  const match = html.match(new RegExp(`<${name}[^>]*>`));
  if (match === null) throw new Error(`No <${name}> in the markup`);
  return match[0];
}

/** The full <option> tag for one value, so its attributes can be checked. */
function optionTag(html: string, value: string): string {
  const match = html.match(new RegExp(`<option[^>]*value="${value}"[^>]*>`));
  if (match === null) throw new Error(`No option for ${value || "All"}`);
  return match[0];
}

const sampleCounts = counts({
  CONSTRUCTION_REPAIR: 3,
  TRANSPORT: 1,
  EQUIPMENT: 1,
  MATERIAL_SUPPLIER: 3,
});

describe("VipPartnersPage category dropdown", () => {
  it("is a labelled GET form to the partners page, so it works without JavaScript", () => {
    const html = render({ categoryCounts: sampleCounts });

    const form = tagOf(html, "form");
    expect(form).toContain('class="vip-filter-form"');
    expect(form).toContain('action="/en/partners"');
    expect(form).toContain('method="get"');
    expect(html).toContain(
      '<label for="vip-specialty">Service category</label>',
    );
    expect(html).toMatch(/<select[^>]*name="specialty"[^>]*id="vip-specialty"/);
    expect(html).toContain(
      '<button class="button button-primary vip-filter-submit" type="submit">Apply filters</button>',
    );
  });

  it("lists All and each category with its count in the label", () => {
    const html = render({ categoryCounts: sampleCounts });

    expect(html).toContain(">All categories (8)</option>");
    expect(html).toContain(">Construction &amp; repair (3)</option>");
    expect(html).toContain(">Transport &amp; delivery (1)</option>");
    expect(html).toContain(">Materials &amp; supply (3)</option>");
  });

  it("follows the selected category on every render, so a soft navigation updates it", () => {
    // The select is controlled by `selected`: a new prop (the Clear link, or a
    // category picked after a soft navigation) must move the selection.
    const transport = render({
      selected: "TRANSPORT",
      categoryCounts: sampleCounts,
    });
    const all = render({ selected: null, categoryCounts: sampleCounts });
    const transportAgain = render({
      selected: "TRANSPORT",
      categoryCounts: sampleCounts,
    });

    expect(optionTag(transport, "TRANSPORT")).toContain("selected");
    expect(optionTag(all, "TRANSPORT")).not.toContain("selected");
    expect(optionTag(all, "")).toContain("selected");
    expect(optionTag(transportAgain, "TRANSPORT")).toContain("selected");
  });

  it("turns browser autocomplete off, so a restored form cannot show a stale category", () => {
    const html = render({ categoryCounts: sampleCounts });

    expect(tagOf(html, "form")).toMatch(/autocomplete="off"/i);
    expect(tagOf(html, "select")).toMatch(/autocomplete="off"/i);
  });

  it("selects All by default and the requested category when filtered", () => {
    expect(optionTag(render({ categoryCounts: sampleCounts }), "")).toContain(
      "selected",
    );
    const filtered = render({
      selected: "TRANSPORT",
      categoryCounts: sampleCounts,
    });
    expect(optionTag(filtered, "TRANSPORT")).toContain("selected");
    expect(optionTag(filtered, "")).not.toContain("selected");
  });

  it("keeps zero-count categories in the list but disabled", () => {
    const html = render({ categoryCounts: sampleCounts });
    const daily = optionTag(html, "DAILY_LABOR");

    expect(daily).toContain("disabled");
    expect(html).toContain(">Labor &amp; site support (0)</option>");
    expect(optionTag(html, "TRANSPORT")).not.toContain("disabled");
  });

  it("counts All from the full eligible set, not the filtered results", () => {
    const html = render({
      selected: "TRANSPORT",
      partners: [partner("only-transport")],
      categoryCounts: sampleCounts,
    });

    expect(html).toContain(">All categories (8)</option>");
    expect(html).toContain(">Transport &amp; delivery (1)</option>");
  });

  it("uses the Discover labels for the categories", () => {
    const html = render({ categoryCounts: sampleCounts });

    expect(html).toContain(">Construction &amp; repair (3)</option>");
    expect(html).toContain(">Equipment &amp; machinery (1)</option>");
  });

  it("shows the Clear link only while a category is applied", () => {
    expect(render({ categoryCounts: sampleCounts })).not.toContain(
      'class="vip-results-clear"',
    );
    expect(
      render({ selected: "TRANSPORT", categoryCounts: sampleCounts }),
    ).toContain('<a class="vip-results-clear" href="/en/partners">Clear</a>');
  });

  it("has no client-only sidebar or pill markup left", () => {
    const html = render({ categoryCounts: sampleCounts });

    expect(html).not.toContain("vip-filters");
    expect(html).not.toContain("vip-category");
  });
});

describe("VipPartnersPage summary and results line", () => {
  it("uses the singular verb for exactly one partner in English", () => {
    const html = render({ partners: [partner("one")] });

    expect(html).toContain(
      '<p class="vip-summary"><strong>1</strong> partner matches your filters</p>',
    );
    expect(html).toContain("Showing 1–1 of 1 partner</p>");
  });

  it("uses the plural forms for several partners in English", () => {
    const html = render({
      partners: [partner("a"), partner("b"), partner("c")],
    });

    expect(html).toContain("<strong>3</strong> partners match your filters");
    expect(html).toContain("Showing 1–3 of 3 partners");
  });

  it("names the category in the filtered summary", () => {
    const html = render({
      selected: "TRANSPORT",
      partners: [partner("t", { specialty: "TRANSPORT" })],
      categoryCounts: sampleCounts,
    });

    expect(html).toContain(
      '<p class="vip-summary"><strong>1</strong> partner in Transport &amp; delivery</p>',
    );
  });

  it("uses the three Russian noun forms in the summary and the results line", () => {
    const summaryFor = (count: number) => {
      const partners = Array.from({ length: count }, (_, index) =>
        partner(`ru-${index}`),
      );
      return render({ partners, locale: "ru" });
    };

    expect(summaryFor(1)).toContain(
      "<strong>1</strong> партнёр подходит под ваши фильтры",
    );
    expect(summaryFor(2)).toContain(
      "<strong>2</strong> партнёра подходят под ваши фильтры",
    );
    expect(summaryFor(5)).toContain(
      "<strong>5</strong> партнёров подходят под ваши фильтры",
    );
    expect(summaryFor(21)).toContain(
      "<strong>21</strong> партнёр подходит под ваши фильтры",
    );
    expect(summaryFor(1)).toContain("Показано 1–1 из 1 партнёра");
    expect(summaryFor(2)).toContain("Показано 1–2 из 2 партнёров");
  });

  it("names the category with the Russian plural in the filtered summary", () => {
    const html = render({
      locale: "ru",
      selected: "TRANSPORT",
      partners: [
        partner("t", { specialty: "TRANSPORT" }),
        partner("u", { specialty: "TRANSPORT" }),
      ],
      categoryCounts: sampleCounts,
    });

    expect(html).toContain(
      "<strong>2</strong> партнёра в категории «Транспорт и доставка»",
    );
  });

  it("puts the results, dropdown included, in one polite live region", () => {
    const html = render({ partners: [partner("a")] });

    expect(html).toContain('<section aria-live="polite" class="vip-results">');
    expect(html.indexOf('aria-live="polite"')).toBeLessThan(
      html.indexOf('class="vip-filter-form"'),
    );
  });
});

describe("VipPartnersPage cards and become card", () => {
  it("renders each partner as one link to the profile in the current locale", () => {
    const html = render({
      locale: "ka",
      partners: [partner("p1"), partner("p2")],
    });

    expect(html).toContain(
      '<a class="vip-partner-card" href="/ka/profiles/p1">',
    );
    expect(html).toContain(
      '<a class="vip-partner-card" href="/ka/profiles/p2">',
    );
    // Each card is the only link inside it: the cards add no nested links.
    const cards = html.split('<a class="vip-partner-card"').slice(1);
    for (const card of cards) {
      const body = card.slice(0, card.indexOf("</a>"));
      expect(body).not.toContain("<a ");
    }
  });

  it("puts the become card last in the grid, after every partner card", () => {
    const html = render({
      partners: [partner("a"), partner("b"), partner("c")],
    });
    const items = gridItems(html);

    expect(items).toHaveLength(4);
    expect(items.at(-1)).toContain('class="vip-become-card"');
    expect(
      items.slice(0, -1).every((item) => item.includes("vip-partner-card")),
    ).toBe(true);
  });

  it("uses an empty alt on the logo and falls back to an icon without one", () => {
    const html = render({
      partners: [partner("with-logo"), partner("no-logo", { logoPath: null })],
    });

    expect(html).toContain('alt=""');
    expect(html).toContain('src="/vip/logos/with-logo_icon.svg"');
    expect(html).not.toContain('src="/vip/logos/no-logo');
    expect(html).toContain("vip-partner-logo-fallback");
  });

  it("shows the rating to one decimal, and hides the star when unrated", () => {
    const html = render({
      partners: [
        partner("rated", { rating: 4.5 }),
        partner("new", { rating: null }),
      ],
    });

    expect(html.match(/class="vip-partner-rating"/g)?.length).toBe(1);
    expect(html).toContain('<span class="vip-partner-score">4.5</span>');
  });

  it("formats the completed count in the locale's plural form", () => {
    const en1 = render({ partners: [partner("x", { completed: 1 })] });
    const ru2 = render({
      locale: "ru",
      partners: [partner("x", { completed: 2 })],
    });

    expect(en1).toContain(
      '<span class="vip-partner-completed">1 completed</span>',
    );
    expect(ru2).toContain(
      '<span class="vip-partner-completed">2 завершено</span>',
    );
  });

  it("omits the description when the partner has none", () => {
    const html = render({
      partners: [partner("bare", { description: null })],
    });

    expect(html).not.toContain("vip-partner-desc");
  });

  it("marks verified partners with the verified label", () => {
    const html = render({
      partners: [partner("v"), partner("u", { verified: false })],
    });

    expect(
      html.split(messagesByLocale.en.providerProfile.verifiedProvider).length -
        1,
    ).toBe(1);
  });

  it("adds the mint category tag from the Discover labels", () => {
    const html = render({
      partners: [partner("tag", { specialty: "MATERIAL_SUPPLIER" })],
    });

    expect(html).toContain(
      '<span class="vip-partner-tag" title="Materials &amp; supply">Materials &amp; supply</span>',
    );
  });

  it("links the become card and the header button to the contact address", () => {
    const html = render({ partners: [partner("a")] });

    expect(html.split(`href="${contactHref}"`).length - 1).toBe(2);
    expect(html).toContain("Apply for VIP");
    expect(html).toContain("Become a VIP partner");
  });
});

describe("VipPartnersPage empty state", () => {
  it("shows the empty message and the become card, with no count line", () => {
    const html = render({
      selected: "DAILY_LABOR",
      categoryCounts: sampleCounts,
    });

    expect(html).toContain(
      '<li class="vip-empty">No partners in this category yet.</li>',
    );
    expect(html).toContain('class="vip-become-card"');
    expect(html).not.toContain('class="vip-count"');
    expect(html).not.toContain('class="vip-partner-card"');
  });

  it("keeps the summary line on an empty result", () => {
    const html = render({
      selected: "DAILY_LABOR",
      categoryCounts: sampleCounts,
    });

    expect(html).toContain(
      '<p class="vip-summary"><strong>0</strong> partners in Labor &amp; site support</p>',
    );
  });
});

describe("VipPartnersPage header", () => {
  it("shows the breadcrumb, the title, the subtitle and the disclosure", () => {
    const html = render();

    expect(html).toContain('<nav aria-label="Breadcrumb" class="vip-crumb">');
    expect(html).toContain('<a href="/en">Home</a>');
    expect(html).toContain('<h1 class="vip-page-title">VIP Lounge</h1>');
    expect(html).toContain(en.vip.page.subtitle);
    expect(html).toContain(en.vip.disclosure.replaceAll("'", "&#x27;"));
  });
});
