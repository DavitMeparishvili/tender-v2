import { isVerifiedProvider } from "../../profiles/domain/profile";
import {
  isLoungeEligible,
  isVipSpecialty,
  type VipSpecialty,
} from "../domain/partner";
import { pickLocalizedText } from "../domain/localized-text";
import type {
  VipPartnerCandidate,
  VipPartnerRepository,
} from "./vip-partner-repository";

export type EligiblePartnerCandidate = VipPartnerCandidate &
  Readonly<{ specialty: VipSpecialty | null; verified: boolean }>;

/**
 * Applies the Lounge eligibility rule to every membership. The label check
 * uses English because English is the fallback for every locale, so a partner
 * never drops out of one language's Lounge because of another's copy.
 */
export async function loadEligiblePartnerCandidates(
  repository: VipPartnerRepository,
): Promise<readonly EligiblePartnerCandidate[]> {
  const rows = await repository.listMembershipCandidates();
  return rows.flatMap((row) => {
    const verified = isVerifiedProvider({
      emailVerified: row.emailVerified,
      onboardingComplete: row.onboardingComplete,
    });
    const eligible = isLoungeEligible({
      membershipActive: row.membershipActive,
      isProvider: row.isProvider,
      isVerified: verified,
      isDisabled: row.isDisabled,
      hasServiceLabel: pickLocalizedText(row.serviceLabel, "en") !== null,
    });
    if (!eligible) return [];
    const first = row.specialties[0];
    return [
      {
        ...row,
        specialty: isVipSpecialty(first) ? first : null,
        verified,
      },
    ];
  });
}
