export type LoungeLocale = "ka" | "en" | "ru";

const FALLBACK_LOCALE: LoungeLocale = "en";

/**
 * Picks the text for `locale` from a stored {"en": "...", "ka": "...", ...}
 * object. A missing or blank entry falls back to English; null means no
 * usable text exists in either language.
 */
export function pickLocalizedText(
  value: unknown,
  locale: LoungeLocale,
): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const entries = value as Readonly<Record<string, unknown>>;
  for (const candidate of [locale, FALLBACK_LOCALE]) {
    const text = entries[candidate];
    if (typeof text === "string" && text.trim().length > 0) {
      return text.trim();
    }
  }
  return null;
}
