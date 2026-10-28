import { database } from "../../../infrastructure/db/client";
import type { ReviewScores } from "../../reviews/domain/review";
import type {
  ActiveVipMembership,
  VipMembershipRepository,
  VipPartnerCandidate,
  VipPartnerRepository,
} from "../application/vip-partner-repository";

export class PrismaVipRepository
  implements VipPartnerRepository, VipMembershipRepository
{
  async findActiveMembership(
    userId: string,
  ): Promise<ActiveVipMembership | null> {
    const row = await database.vipMembership.findFirst({
      where: { userId, active: true },
      select: { logoPath: true },
    });
    return row === null ? null : { logoPath: row.logoPath };
  }

  async listMembershipCandidates(): Promise<readonly VipPartnerCandidate[]> {
    const rows = await database.vipMembership.findMany({
      orderBy: { userId: "asc" },
      select: {
        active: true,
        logoPath: true,
        serviceLabel: true,
        description: true,
        pinnedRank: true,
        user: {
          select: {
            id: true,
            emailVerified: true,
            capabilities: { select: { code: true } },
            profile: {
              select: {
                displayName: true,
                city: true,
                onboardingCompleteAt: true,
                disabledAt: true,
              },
            },
            providerProfile: { select: { specialties: true } },
          },
        },
      },
    });

    return rows.flatMap((row) => {
      const { user } = row;
      // Every eligible partner completed onboarding, which creates the profile.
      if (user.profile === null) return [];
      return [
        {
          userId: user.id,
          membershipActive: row.active,
          displayName: user.profile.displayName,
          city: user.profile.city,
          isProvider: user.capabilities.some(
            (capability) => capability.code === "PROVIDER",
          ),
          emailVerified: user.emailVerified,
          onboardingComplete: user.profile.onboardingCompleteAt !== null,
          isDisabled: user.profile.disabledAt !== null,
          specialties: user.providerProfile?.specialties ?? [],
          serviceLabel: row.serviceLabel,
          description: row.description,
          logoPath: row.logoPath,
          pinnedRank: row.pinnedRank,
        },
      ];
    });
  }

  async findActiveMemberIds(
    userIds: readonly string[],
  ): Promise<ReadonlySet<string>> {
    const rows = await database.vipMembership.findMany({
      where: { userId: { in: [...userIds] }, active: true },
      select: { userId: true },
    });
    return new Set(rows.map((row) => row.userId));
  }

  async countCompletedAgreements(
    providerIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>> {
    const rows = await database.agreement.groupBy({
      by: ["providerId"],
      where: { providerId: { in: [...providerIds] }, status: "COMPLETED" },
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [row.providerId, row._count._all]));
  }

  async listPublishedReviewScores(
    reviewedIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly ReviewScores[]>> {
    const rows = await database.review.findMany({
      where: { reviewedId: { in: [...reviewedIds] }, status: "PUBLISHED" },
      select: {
        reviewedId: true,
        quality: true,
        deadline: true,
        communication: true,
        agreedPrice: true,
      },
    });
    const byReviewed = new Map<string, ReviewScores[]>();
    for (const row of rows) {
      const scores = byReviewed.get(row.reviewedId) ?? [];
      scores.push({
        quality: row.quality,
        deadline: row.deadline,
        communication: row.communication,
        agreedPrice: row.agreedPrice,
      });
      byReviewed.set(row.reviewedId, scores);
    }
    return byReviewed;
  }
}

export const prismaVipRepository = new PrismaVipRepository();
