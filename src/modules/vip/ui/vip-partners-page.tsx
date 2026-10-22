import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import type { VipPartner, VipSpecialty } from "../domain/partner";
import { fillTemplate, pluralTemplate } from "../domain/plural-forms";
import {
  partnersPath,
  type PartnerCategoryOption,
} from "../domain/partners-page";
import { VipBecomeCard } from "./vip-become-card";
import { VipCategoryForm, type CategoryFormOption } from "./vip-category-form";
import { vipCategoryLabel } from "./vip-category-label";
import { VipPartnerCard } from "./vip-partner-card";

/**
 * Renders a summary template with its {count} bold, as the handoff shows it.
 * Only the count is wrapped, so the sentence reads the same in every language.
 */
function renderSummary(
  template: string,
  countText: string,
  values: Readonly<Record<string, string>>,
): ReactNode[] {
  return template.split("{count}").flatMap((part, index) => {
    const text = fillTemplate(part, values);
    return index === 0
      ? [text]
      : [<strong key={`count-${index}`}>{countText}</strong>, text];
  });
}

/**
 * Dropdown options: "All categories (8)", then each category with its count.
 * Zero-count categories stay in the list but are disabled, as on Discover.
 */
function dropdownOptions(
  options: readonly PartnerCategoryOption[],
  messages: Messages,
): readonly CategoryFormOption[] {
  return options.map((option) => {
    const name =
      option.specialty === null
        ? messages.tenders.filterAllSpecialties
        : vipCategoryLabel(option.specialty, messages);
    return {
      value: option.specialty ?? "",
      label: `${name} (${option.count})`,
      disabled: option.empty,
    };
  });
}

/**
 * The All partners page body (handoff section 4): header, a toolbar with the
 * results summary and the category dropdown, then the grid and the "Become a
 * VIP partner" card. Every partner is shown on one page, so there is no paging.
 */
export function VipPartnersPage({
  locale,
  messages,
  partners,
  options,
  selected,
  contactHref,
}: Readonly<{
  locale: Locale;
  messages: Messages;
  partners: readonly VipPartner[];
  options: readonly PartnerCategoryOption[];
  selected: VipSpecialty | null;
  contactHref: string;
}>) {
  const copy = messages.vip;
  const count = partners.length;
  const countText = new Intl.NumberFormat(locale).format(count);

  const summary =
    selected === null
      ? renderSummary(
          pluralTemplate(copy.summaryAll, count, locale),
          countText,
          {},
        )
      : renderSummary(
          pluralTemplate(copy.summaryCategory, count, locale),
          countText,
          { category: vipCategoryLabel(selected, messages) },
        );

  return (
    <div className="vip-partners-page">
      <div className="band-inner vip-partners-inner">
        <header className="vip-page-header">
          <div className="vip-page-heading">
            <nav aria-label={copy.breadcrumb} className="vip-crumb">
              <Link href={`/${locale}`}>{messages.nav.home}</Link>
              <span aria-hidden="true"> / </span>
              <span aria-current="page">{copy.title}</span>
            </nav>
            <h1 className="vip-page-title">{copy.title}</h1>
            <p className="vip-page-subtitle">{copy.page.subtitle}</p>
            <p className="vip-page-disclosure">
              <span aria-hidden="true">ⓘ </span>
              {copy.disclosure}
            </p>
          </div>
          <a className="vip-page-become" href={contactHref}>
            {copy.become}
          </a>
        </header>

        <section aria-live="polite" className="vip-results">
          <div className="vip-toolbar">
            <VipCategoryForm
              applyLabel={messages.tenders.applyFilters}
              fieldLabel={messages.tenders.filterSpecialty}
              locale={locale}
              options={dropdownOptions(options, messages)}
              selected={selected ?? ""}
            />
            <div className="vip-toolbar-summary">
              <p className="vip-summary">{summary}</p>
              {selected !== null ? (
                <Link
                  className="vip-results-clear"
                  href={partnersPath(locale, null)}
                >
                  {copy.clear}
                </Link>
              ) : null}
            </div>
          </div>

          <ul className="vip-grid">
            {count === 0 ? (
              <li className="vip-empty">{copy.empty}</li>
            ) : (
              partners.map((partner) => (
                <VipPartnerCard
                  key={partner.userId}
                  locale={locale}
                  messages={messages}
                  partner={partner}
                />
              ))
            )}
            <VipBecomeCard contactHref={contactHref} messages={messages} />
          </ul>

          {count > 0 ? (
            <p className="vip-count">
              {fillTemplate(pluralTemplate(copy.showingAll, count, locale), {
                n: countText,
              })}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
