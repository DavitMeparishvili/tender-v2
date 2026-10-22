// Mirrors the ProviderSpecialtyCode enum in the database. The domain layer
// cannot import the generated Prisma types, so the values are listed here.
export const VIP_SPECIALTIES = [
  "CONSTRUCTION_REPAIR",
  "TRANSPORT",
  "EQUIPMENT",
  "DAILY_LABOR",
  "MATERIAL_SUPPLIER",
] as const;

export type VipSpecialty = (typeof VIP_SPECIALTIES)[number];

export function isVipSpecialty(value: unknown): value is VipSpecialty {
  return VIP_SPECIALTIES.some((specialty) => specialty === value);
}

/** The facts the Lounge eligibility rule reads, one per account. */
export type LoungeEligibilityFacts = Readonly<{
  membershipActive: boolean;
  isProvider: boolean;
  /** The verification test shared with the public profile page. */
  isVerified: boolean;
  isDisabled: boolean;
  hasServiceLabel: boolean;
}>;

/**
 * Lounge eligibility (spec section 3): an active membership, the PROVIDER
 * capability, a verified profile, not disabled, and a service label.
 */
export function isLoungeEligible(facts: LoungeEligibilityFacts): boolean {
  return (
    facts.membershipActive &&
    facts.isProvider &&
    facts.isVerified &&
    !facts.isDisabled &&
    facts.hasServiceLabel
  );
}

export type VipPartner = Readonly<{
  userId: string;
  name: string;
  city: string;
  specialty: VipSpecialty | null;
  serviceLabel: string;
  description: string | null;
  logoPath: string | null;
  verified: boolean;
  /** Mean overall score of published reviews, one decimal; null when unrated. */
  rating: number | null;
  /** Count of the provider's COMPLETED agreements. */
  completed: number;
}>;
