import type { Locale } from "../../localization/config";
import type { TenderCurrency, TenderStatus } from "../domain/tender";

const intlLocales: Readonly<Record<Locale, string>> = {
  en: "en",
  ka: "ka",
};

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
  locale: Locale,
) {
  if (minorUnits === null || currency === null) return null;

  return new Intl.NumberFormat(intlLocales[locale], {
    style: "currency",
    currency,
  }).format(minorUnits / 100);
}

export function tenderStatusLabel(
  status: TenderStatus,
  labels: Readonly<Record<TenderStatus, string>>,
) {
  return labels[status];
}
