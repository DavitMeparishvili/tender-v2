// Chromium builds without Georgian ICU data fall back to English. Explicit
// labels keep server-rendered calendars and browser hydration identical.
export const georgianMonths = [
  "იანვარი",
  "თებერვალი",
  "მარტი",
  "აპრილი",
  "მაისი",
  "ივნისი",
  "ივლისი",
  "აგვისტო",
  "სექტემბერი",
  "ოქტომბერი",
  "ნოემბერი",
  "დეკემბერი",
] as const;
export const georgianWeekdays = [
  "ორშ",
  "სამ",
  "ოთხ",
  "ხუთ",
  "პარ",
  "შაბ",
  "კვი",
] as const;
export function georgianDateLabel(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return `${day} ${georgianMonths[(month ?? 1) - 1]}, ${year}`;
}
