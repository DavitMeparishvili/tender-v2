import type { ReviewScores } from "../../reviews/domain/review";

/** One account that has (or had) a VIP membership, with the fields the Lounge reads. */
export type VipPartnerCandidate = Readonly<{
  userId: string;
  membershipActive: boolean;
  displayName: string;
  city: string;
  isProvider: boolean;
  emailVerified: boolean;
  onboardingComplete: boolean;
  isDisabled: boolean;
  // ProviderProfile.specialties in stored order; the first entry is the category.
  specialties: readonly string[];
  serviceLabel: unknown;
  description: unknown;
  logoPath: string | null;
  // Pinned partners lead the Lounge, lowest rank first; null rotates daily.
  pinnedRank: number | null;
}>;

export interface VipPartnerRepository {
  listMembershipCandidates(): Promise<readonly VipPartnerCandidate[]>;
  findActiveMemberIds(userIds: readonly string[]): Promise<ReadonlySet<string>>;
  countCompletedAgreements(
    providerIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>>;
  listPublishedReviewScores(
    reviewedIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly ReviewScores[]>>;
}

/** The one membership fact a profile page needs: the logo, when one is set. */
export type ActiveVipMembership = Readonly<{ logoPath: string | null }>;

export interface VipMembershipRepository {
  findActiveMembership(userId: string): Promise<ActiveVipMembership | null>;
}
