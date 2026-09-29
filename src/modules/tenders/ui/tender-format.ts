import type { Locale } from "../../localization/config";
import type { TenderCurrency, TenderStatus } from "../domain/tender";

const intlLocales: Readonly<Record<Locale, string>> = {
  en: "en",
  ka: "ka",
  ru: "ru",
};

export function tenderNumberFormat(
  locale: Locale,
  options: Intl.NumberFormatOptions = {},
) {
  // Georgian uses comma decimals and spaces with grouping from five digits.
  // Some browser builds omit ka ICU data; ru supplies the same separators.
  return new Intl.NumberFormat(locale === "ka" ? "ru-RU" : locale, {
    ...options,
    ...(locale === "ka" ? { useGrouping: "min2" } : {}),
  });
}

export function formatTenderDate(value: Date | string | null, locale: Locale) {
  if (value === null) return null;

  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.valueOf())) return null;

  return new Intl.DateTimeFormat(intlLocales[locale], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tbilisi",
  }).format(date);
}

export function formatTenderMoney(
  minorUnits: number | null,
  currency: TenderCurrency | null,
  _locale: Locale,
) {
  if (minorUnits === null || currency === null) return null;
  // Keep the locale argument for callers; money entry/display intentionally
  // uses the same separators in all three interface languages.
  void _locale;

  // Match the amount fields across languages: comma groups, decimal point,
  // and an unambiguous currency code kept with the amount on narrow screens.
  const amount = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: minorUnits % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(minorUnits / 100);
  return `${amount}\u00a0${currency}`;
}

const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * KILOBYTE;

// The 1024-based steps match `MAX_ATTACHMENT_BYTES`, so the largest accepted
// file reads back as exactly the "15 MB" the upload hint promises.
export function formatAttachmentSize(
  sizeBytes: number,
  locale: Locale,
  units: Readonly<{ bytes: string; kilobytes: string; megabytes: string }>,
) {
  const format = (value: number, maximumFractionDigits: number) =>
    tenderNumberFormat(locale, {
      maximumFractionDigits,
    }).format(value);

  if (sizeBytes >= MEGABYTE) {
    return units.megabytes.replace("{size}", format(sizeBytes / MEGABYTE, 1));
  }
  if (sizeBytes >= KILOBYTE) {
    return units.kilobytes.replace("{size}", format(sizeBytes / KILOBYTE, 0));
  }
  return units.bytes.replace("{size}", format(sizeBytes, 0));
}

export function tenderStatusLabel(
  status: TenderStatus,
  labels: Readonly<Record<TenderStatus, string>>,
) {
  return labels[status];
}
