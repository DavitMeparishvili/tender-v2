export const SUPPORTED_LOCALES = ["ka", "en"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ka";

export function isLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.some((locale) => locale === value);
}
