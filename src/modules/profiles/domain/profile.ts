export type AccountKind = "PERSON" | "COMPANY";
export type CountryCode = "GE";
export type PreferredLocale = "ka" | "en" | "ru";
export type PreferredCurrency = "GEL" | "USD";

export type MarketplaceProfile = Readonly<{
  accountKind: AccountKind;
  displayName: string;
  phoneE164: string;
  countryCode: CountryCode;
  city: string;
  activityDescription: string;
  preferredLocale: PreferredLocale;
  preferredCurrency: PreferredCurrency;
  profilePhotoObjectKey: string | null;
}>;
