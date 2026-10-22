/** Home-strip limits from the VIP Lounge handoff (business rules 5, 6). */
export const LOUNGE_STRIP_RULES = {
  /** The strip never shows more partners than this. */
  maxPartners: 12,
  /** The whole strip is hidden when fewer partners than this qualify. */
  minPartnersToShow: 4,
  /** Arrows appear only from this many partners; 4-5 partners scroll without them. */
  minPartnersForArrows: 6,
} as const;

export type LoungeStrip<T> = Readonly<{
  visible: boolean;
  showArrows: boolean;
  partners: readonly T[];
}>;

/**
 * Applies the strip rules to partners already in rotation order. The first
 * `maxPartners` are kept; when the strip is hidden, no partners are returned.
 */
export function selectLoungeStrip<T>(
  rotatedPartners: readonly T[],
): LoungeStrip<T> {
  const qualifying = rotatedPartners.length;
  if (qualifying < LOUNGE_STRIP_RULES.minPartnersToShow) {
    return { visible: false, showArrows: false, partners: [] };
  }
  return {
    visible: true,
    showArrows: qualifying >= LOUNGE_STRIP_RULES.minPartnersForArrows,
    partners: rotatedPartners.slice(0, LOUNGE_STRIP_RULES.maxPartners),
  };
}
