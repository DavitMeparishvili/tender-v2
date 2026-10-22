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

/**
 * The "Verified provider" test that the public profile page uses for its tag:
 * a confirmed email address and a completed profile.
 */
export function isVerifiedProvider(
  facts: Readonly<{ emailVerified: boolean; onboardingComplete: boolean }>,
): boolean {
  return facts.emailVerified && facts.onboardingComplete;
}
