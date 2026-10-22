import { VIP_SPECIALTIES, isVipSpecialty, type VipSpecialty } from "./partner";

export type PartnerCategoryCounts = Readonly<{
  total: number;
  bySpecialty: Readonly<Record<VipSpecialty, number>>;
}>;

export type PartnerCategoryOption = Readonly<{
  /** null is "All categories". */
  specialty: VipSpecialty | null;
  count: number;
  selected: boolean;
  /** Zero-count categories are disabled on desktop and hidden on mobile. */
  empty: boolean;
}>;

export type PartnersSearchParam = string | readonly string[] | undefined;

/**
 * Reads `?specialty=`. Only one known category code filters the page. A
 * missing, repeated, or unknown value means no filter, so the page never
 * fails on a bad link.
 */
export function parseSpecialtyParam(
  value: PartnersSearchParam,
): VipSpecialty | null {
  return typeof value === "string" && isVipSpecialty(value) ? value : null;
}

export function partnersPath(
  locale: string,
  specialty: VipSpecialty | null,
): string {
  return specialty === null
    ? `/${locale}/partners`
    : `/${locale}/partners?specialty=${specialty}`;
}

/**
 * The filter options in display order: All, then the Discover categories. The
 * counts come from the full eligible set, never from the filtered results.
 */
export function categoryOptions(
  counts: PartnerCategoryCounts,
  selected: VipSpecialty | null,
): readonly PartnerCategoryOption[] {
  const all: PartnerCategoryOption = {
    specialty: null,
    count: counts.total,
    selected: selected === null,
    empty: counts.total === 0,
  };
  const categories = VIP_SPECIALTIES.map((specialty) => {
    const count = counts.bySpecialty[specialty];
    return {
      specialty,
      count,
      selected: specialty === selected,
      empty: count === 0,
    };
  });
  return [all, ...categories];
}
