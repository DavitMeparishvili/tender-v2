import {
  aggregatePublishedReviews,
  type ReviewScores,
} from "../../reviews/domain/review";
import { pickLocalizedText, type LoungeLocale } from "../domain/localized-text";
import { loungeOrder, tbilisiDateKey } from "../domain/lounge-rotation";
import type { VipPartner, VipSpecialty } from "../domain/partner";
import {
  loadEligiblePartnerCandidates,
  type EligiblePartnerCandidate,
} from "./eligible-partners";
import type { VipPartnerRepository } from "./vip-partner-repository";

export type ListVipPartnersQuery = Readonly<{
  locale: LoungeLocale;
  now: Date;
  specialty?: VipSpecialty;
}>;

// Means are shown to one decimal, as on the profile page's rating.
function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function createListVipPartners(
  dependencies: Readonly<{ repository: VipPartnerRepository }>,
) {
  return async function listVipPartners(
    query: ListVipPartnersQuery,
  ): Promise<readonly VipPartner[]> {
    const { repository } = dependencies;
    const eligible = await loadEligiblePartnerCandidates(repository);
    // Ordering happens before the category filter, so a category keeps the
    // same relative order that the full Lounge has on that day.
    const rotated = loungeOrder(eligible, tbilisiDateKey(query.now)).filter(
      (candidate) =>
        query.specialty === undefined ||
        candidate.specialty === query.specialty,
    );
    if (rotated.length === 0) return [];

    const ids = rotated.map((candidate) => candidate.userId);
    const [completed, reviews] = await Promise.all([
      repository.countCompletedAgreements(ids),
      repository.listPublishedReviewScores(ids),
    ]);

    return rotated.map((candidate: EligiblePartnerCandidate) => {
      const scores: readonly ReviewScores[] =
        reviews.get(candidate.userId) ?? [];
      const overall = aggregatePublishedReviews(
        scores.map((score) => ({
          status: "PUBLISHED" as const,
          scores: score,
        })),
      ).overall;
      return {
        userId: candidate.userId,
        name: candidate.displayName,
        city: candidate.city,
        specialty: candidate.specialty,
        serviceLabel:
          pickLocalizedText(candidate.serviceLabel, query.locale) ?? "",
        description: pickLocalizedText(candidate.description, query.locale),
        logoPath: candidate.logoPath,
        verified: candidate.verified,
        rating: overall === null ? null : roundToOneDecimal(overall),
        completed: completed.get(candidate.userId) ?? 0,
      };
    });
  };
}

export async function listVipPartners(query: ListVipPartnersQuery) {
  const { prismaVipRepository } =
    await import("../infrastructure/prisma-vip-repository");
  return createListVipPartners({ repository: prismaVipRepository })(query);
}
