import type { PublicTenderSummary } from "../domain/masking";
import type { DiscoverySearchParams } from "./discovery-query";

export const DISCOVERY_SORTS = ["newest", "closing", "budget"] as const;
export type DiscoverySort = (typeof DISCOVERY_SORTS)[number];

export const DISCOVERY_PAGE_SIZES = [5, 10, 20, 50] as const;
export type DiscoveryPageSize = (typeof DISCOVERY_PAGE_SIZES)[number];

export const DEFAULT_DISCOVERY_PAGE_SIZE: DiscoveryPageSize = 5;

export type DiscoveryView = Readonly<{
  sort: DiscoverySort;
  page: number;
  pageSize: DiscoveryPageSize;
}>;

function single(
  searchParams: DiscoverySearchParams,
  key: string,
): string | undefined {
  const value = searchParams[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Sort and paging live in the URL beside the filters, so a result page is
 * shareable and the back button returns to the same list. Anything
 * unrecognised falls back to the default rather than erroring — a bad `page`
 * in a pasted link should still show results.
 */
export function parseDiscoveryView(
  searchParams: DiscoverySearchParams,
): DiscoveryView {
  const sortValue = single(searchParams, "sort");
  const sort = DISCOVERY_SORTS.find((value) => value === sortValue) ?? "newest";

  const pageSizeValue = Number(single(searchParams, "pageSize"));
  const pageSize =
    DISCOVERY_PAGE_SIZES.find((value) => value === pageSizeValue) ??
    DEFAULT_DISCOVERY_PAGE_SIZE;

  const pageValue = Number(single(searchParams, "page"));
  const page = Number.isInteger(pageValue) && pageValue >= 1 ? pageValue : 1;

  return { sort, page, pageSize };
}

const comparators: Readonly<
  Record<
    DiscoverySort,
    (a: PublicTenderSummary, b: PublicTenderSummary) => number
  >
> = {
  newest: (a, b) => b.publishedAt.localeCompare(a.publishedAt),
  closing: (a, b) => a.deadline.localeCompare(b.deadline),
  // Budgets are integer minor units, and a cross-currency comparison would be
  // meaningless, so equal amounts in different currencies keep a stable order
  // by id rather than pretending one outranks the other.
  budget: (a, b) =>
    b.budgetMinorUnits - a.budgetMinorUnits || a.id.localeCompare(b.id),
};

export function sortTenders(
  tenders: readonly PublicTenderSummary[],
  sort: DiscoverySort,
): readonly PublicTenderSummary[] {
  return [...tenders].sort(comparators[sort]);
}

export type DiscoveryPage = Readonly<{
  items: readonly PublicTenderSummary[];
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
}>;

export function paginateTenders(
  tenders: readonly PublicTenderSummary[],
  view: DiscoveryView,
): DiscoveryPage {
  const total = tenders.length;
  const pageCount = Math.max(1, Math.ceil(total / view.pageSize));
  const page = Math.min(view.page, pageCount);
  const start = (page - 1) * view.pageSize;
  const items = tenders.slice(start, start + view.pageSize);

  return {
    items,
    page,
    pageCount,
    total,
    from: total === 0 ? 0 : start + 1,
    to: start + items.length,
  };
}

/**
 * Builds a link that changes one axis of the view and leaves every filter in
 * place. Changing sort or page size returns to page 1, because staying on
 * page 7 of a differently ordered list shows the user an arbitrary slice.
 */
export function discoveryHref(
  pathname: string,
  searchParams: Pick<URLSearchParams, "toString">,
  patch: Readonly<Record<string, string | number | null>>,
): string {
  const next = new URLSearchParams(searchParams.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/**
 * The numbered pager collapses to first / neighbours / last with gaps, so a
 * long result set does not push a hundred targets into the tab order.
 *
 * `compact` is the phone window: first, current and last only, so the row
 * (with the two arrow buttons) still fits on one line at 320px.
 */
export function pagerSlots(
  page: number,
  pageCount: number,
  compact = false,
): readonly (number | "gap")[] {
  if (pageCount <= (compact ? 3 : 7)) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const slots = new Set<number>([1, pageCount, page]);
  if (!compact) {
    if (page - 1 > 1) slots.add(page - 1);
    if (page + 1 < pageCount) slots.add(page + 1);
    if (page <= 3) slots.add(2).add(3).add(4);
    if (page >= pageCount - 2) {
      slots
        .add(pageCount - 1)
        .add(pageCount - 2)
        .add(pageCount - 3);
    }
  }

  const ordered = [...slots]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((a, b) => a - b);

  const result: (number | "gap")[] = [];
  let previous = 0;
  for (const value of ordered) {
    if (previous !== 0 && value - previous > 1) result.push("gap");
    result.push(value);
    previous = value;
  }
  return result;
}
