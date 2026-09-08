import { database } from "../../../infrastructure/db/client";

export type ProviderRecord = Readonly<{
  memberSince: Date | null;
  offersSubmitted: number;
  tendersWon: number;
  /** Percentage, rounded; null when no offer has been submitted yet. */
  winRate: number | null;
  completedEngagements: number;
  verifications: Readonly<{
    email: boolean;
    phone: boolean;
    profile: boolean;
  }>;
  serviceCounts: readonly Readonly<{ serviceCode: string; count: number }>[];
}>;

/**
 * The public profile claims a track record, so every figure here is counted
 * from the same rows the rest of the product acts on. Anything the platform
 * does not measure yet — on-schedule completion, repeat clients, insurance —
 * is absent rather than estimated.
 */
export async function getProviderRecord(
  userId: string,
): Promise<ProviderRecord> {
  const [user, offersSubmitted, tendersWon, completedEngagements, wonServices] =
    await Promise.all([
      database.user.findUnique({
        where: { id: userId },
        select: {
          createdAt: true,
          emailVerified: true,
          profile: {
            select: { phoneVerifiedAt: true, onboardingCompleteAt: true },
          },
        },
      }),
      database.bid.count({ where: { providerId: userId } }),
      database.bid.count({ where: { providerId: userId, status: "WINNER" } }),
      database.agreement.count({
        where: {
          OR: [{ providerId: userId }, { clientId: userId }],
          status: "COMPLETED",
        },
      }),
      // Which services this provider has actually been selected for, so the
      // "services and completed jobs" chips are earned rather than declared.
      database.bid.findMany({
        where: { providerId: userId, status: "WINNER" },
        select: { tender: { select: { serviceCode: true } } },
      }),
    ]);

  const counts = new Map<string, number>();
  for (const row of wonServices) {
    const code = row.tender.serviceCode;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  return {
    memberSince: user?.createdAt ?? null,
    offersSubmitted,
    tendersWon,
    winRate:
      offersSubmitted === 0
        ? null
        : Math.round((tendersWon / offersSubmitted) * 100),
    completedEngagements,
    verifications: {
      email: user?.emailVerified ?? false,
      phone:
        user?.profile?.phoneVerifiedAt !== null &&
        user?.profile?.phoneVerifiedAt !== undefined,
      profile:
        user?.profile?.onboardingCompleteAt !== null &&
        user?.profile?.onboardingCompleteAt !== undefined,
    },
    serviceCounts: [...counts.entries()]
      .map(([serviceCode, count]) => ({ serviceCode, count }))
      .sort((left, right) => right.count - left.count),
  };
}
