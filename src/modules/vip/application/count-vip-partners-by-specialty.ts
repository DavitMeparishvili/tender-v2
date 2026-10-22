import { VIP_SPECIALTIES, type VipSpecialty } from "../domain/partner";
import { loadEligiblePartnerCandidates } from "./eligible-partners";
import type { VipPartnerRepository } from "./vip-partner-repository";

export type VipPartnerCounts = Readonly<{
  total: number;
  /** Every category is present, with 0 where no partner qualifies. */
  bySpecialty: Readonly<Record<VipSpecialty, number>>;
}>;

/**
 * Counts come from the full eligible set, never from a filtered page, so the
 * filter can show how many partners each category would hold.
 */
export function createCountVipPartnersBySpecialty(
  dependencies: Readonly<{ repository: VipPartnerRepository }>,
) {
  return async function countVipPartnersBySpecialty(): Promise<VipPartnerCounts> {
    const eligible = await loadEligiblePartnerCandidates(
      dependencies.repository,
    );
    const bySpecialty = Object.fromEntries(
      VIP_SPECIALTIES.map((specialty) => [specialty, 0]),
    ) as Record<VipSpecialty, number>;
    for (const candidate of eligible) {
      if (candidate.specialty !== null) {
        bySpecialty[candidate.specialty] += 1;
      }
    }
    return { total: eligible.length, bySpecialty };
  };
}

export async function countVipPartnersBySpecialty(): Promise<VipPartnerCounts> {
  const { prismaVipRepository } =
    await import("../infrastructure/prisma-vip-repository");
  return createCountVipPartnersBySpecialty({
    repository: prismaVipRepository,
  })();
}
