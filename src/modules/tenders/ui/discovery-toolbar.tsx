import Link from "next/link";
import type { Messages } from "../../localization/get-messages";
import { MAX_PUBLISHED_TENDER_RESULTS } from "../application/search-published-tenders";
import {
  DISCOVERY_PAGE_SIZES,
  DISCOVERY_SORTS,
  discoveryHref,
  pagerSlots,
  type DiscoveryPage,
  type DiscoverySort,
  type DiscoveryView,
} from "./discovery-view";

type SearchParams = Pick<URLSearchParams, "toString">;

function sortLabel(sort: DiscoverySort, messages: Messages): string {
  return {
    newest: messages.discovery.sortNewest,
    closing: messages.discovery.sortClosing,
    budget: messages.discovery.sortBudget,
  }[sort];
}

/**
 * Sort is a set of links rather than a control, so the whole result view stays
 * a plain GET: shareable, back-button correct, and usable before hydration.
 */
export function DiscoveryToolbar({
  messages,
  pathname,
  searchParams,
  total,
  view,
}: Readonly<{
  messages: Messages;
  pathname: string;
  searchParams: SearchParams;
  total: number;
  view: DiscoveryView;
}>) {
  const [before, after] = messages.discovery.resultCount.split("{count}");

  const isCapped = total >= MAX_PUBLISHED_TENDER_RESULTS;

  return (
    <div className="result-toolbar">
      <p className="result-count">
        {before}
        <strong>{isCapped ? `${total}+` : total}</strong>
        {after}
      </p>
      <nav aria-label={messages.discovery.sortLabel} className="sort-pills">
        {DISCOVERY_SORTS.map((sort) => (
          <Link
            aria-current={sort === view.sort ? "true" : undefined}
            className="sort-pill"
            href={discoveryHref(pathname, searchParams, { sort, page: null })}
            key={sort}
          >
            {sortLabel(sort, messages)}
          </Link>
        ))}
      </nav>
      {/*
        Discovery reads a fixed maximum per search (see
        MAX_PUBLISHED_TENDER_RESULTS). Saying "50" flat would report the read
        cap as the number of matching tenders, so a capped page says so.
      */}
      {isCapped ? (
        <p className="result-capped">
          {messages.discovery.cappedNote.replace(
            "{count}",
            String(MAX_PUBLISHED_TENDER_RESULTS),
          )}
        </p>
      ) : null}
    </div>
  );
}

export type ActiveFilter = Readonly<{ key: string; label: string }>;

/**
 * Each chip drops exactly one predicate and keeps the rest, so a provider can
 * widen a search one step at a time instead of clearing everything.
 */
export function ActiveFilterChips({
  filters,
  messages,
  pathname,
  searchParams,
}: Readonly<{
  filters: readonly ActiveFilter[];
  messages: Messages;
  pathname: string;
  searchParams: SearchParams;
}>) {
  if (filters.length === 0) return null;

  return (
    <div className="active-filters">
      <span>{messages.discovery.activeFilters}</span>
      {filters.map((filter) => (
        <Link
          aria-label={messages.discovery.removeFilter.replace(
            "{name}",
            filter.label,
          )}
          className="chip"
          href={discoveryHref(pathname, searchParams, {
            [filter.key]: null,
            ...(filter.key === "specialty" ? { serviceCode: null } : {}),
            ...(filter.key === "currency"
              ? { minBudget: null, maxBudget: null }
              : {}),
            page: null,
          })}
          key={filter.key}
        >
          {filter.label}
          <span aria-hidden="true" className="chip-remove">
            ✕
          </span>
        </Link>
      ))}
    </div>
  );
}

export function DiscoveryPager({
  messages,
  page,
  pathname,
  searchParams,
  view,
}: Readonly<{
  messages: Messages;
  page: DiscoveryPage;
  pathname: string;
  searchParams: SearchParams;
  view: DiscoveryView;
}>) {
  if (page.total === 0) return null;

  const href = (target: number) =>
    discoveryHref(pathname, searchParams, {
      page: target === 1 ? null : target,
    });

  return (
    <nav aria-label={messages.discovery.sortLabel} className="pager">
      <p>
        {messages.discovery.showing
          .replace("{from}", String(page.from))
          .replace("{to}", String(page.to))
          .replace("{count}", String(page.total))}
      </p>

      <div className="pager-pages">
        {page.page > 1 ? (
          <Link href={href(page.page - 1)} rel="prev">
            {messages.discovery.previous}
          </Link>
        ) : (
          <span className="is-disabled">{messages.discovery.previous}</span>
        )}

        {pagerSlots(page.page, page.pageCount).map((slot, index) =>
          slot === "gap" ? (
            <span aria-hidden="true" className="is-gap" key={`gap-${index}`}>
              …
            </span>
          ) : slot === page.page ? (
            <span aria-current="page" key={slot}>
              {slot}
            </span>
          ) : (
            <Link
              aria-label={messages.discovery.page.replace(
                "{number}",
                String(slot),
              )}
              href={href(slot)}
              key={slot}
            >
              {slot}
            </Link>
          ),
        )}

        {page.page < page.pageCount ? (
          <Link href={href(page.page + 1)} rel="next">
            {messages.discovery.next}
          </Link>
        ) : (
          <span className="is-disabled">{messages.discovery.next}</span>
        )}
      </div>

      <div className="pager-size">
        <span>{messages.discovery.perPageLabel}</span>
        <div className="pager-pages">
          {DISCOVERY_PAGE_SIZES.map((size) => (
            <Link
              aria-current={size === view.pageSize ? "page" : undefined}
              aria-label={messages.discovery.perPage.replace(
                "{count}",
                String(size),
              )}
              href={discoveryHref(pathname, searchParams, {
                pageSize: size,
                page: null,
              })}
              key={size}
            >
              {size}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
