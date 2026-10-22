import type {
  ActiveVipMembership,
  VipMembershipRepository,
  VipPartnerRepository,
} from "./vip-partner-repository";

/**
 * An account is VIP when it has a membership row with `active = true`. This
 * is membership only: it does not require Lounge eligibility, because VIP
 * clients get badges and ordering without ever appearing in the Lounge.
 */
export function createVipUserIds(
  dependencies: Readonly<{ repository: VipPartnerRepository }>,
) {
  return async function vipUserIds(
    userIds: readonly string[],
  ): Promise<ReadonlySet<string>> {
    if (userIds.length === 0) return new Set();
    return dependencies.repository.findActiveMemberIds(userIds);
  };
}

export async function vipUserIds(
  userIds: readonly string[],
): Promise<ReadonlySet<string>> {
  const { prismaVipRepository } =
    await import("../infrastructure/prisma-vip-repository");
  return createVipUserIds({ repository: prismaVipRepository })(userIds);
}

export async function isVipUser(userId: string): Promise<boolean> {
  return (await vipUserIds([userId])).has(userId);
}

export function createGetActiveVipMembership(
  dependencies: Readonly<{ repository: VipMembershipRepository }>,
) {
  return async function getActiveVipMembership(
    userId: string,
  ): Promise<ActiveVipMembership | null> {
    return dependencies.repository.findActiveMembership(userId);
  };
}

export async function getActiveVipMembership(
  userId: string,
): Promise<ActiveVipMembership | null> {
  const { prismaVipRepository } =
    await import("../infrastructure/prisma-vip-repository");
  return createGetActiveVipMembership({ repository: prismaVipRepository })(
    userId,
  );
}
