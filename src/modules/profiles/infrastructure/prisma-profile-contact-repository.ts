import { database } from "../../../infrastructure/db/client";
import { prismaEntitlementRepository } from "../../access/infrastructure/prisma-entitlement-repository";
import type { ProfileContactRepository } from "../application/get-profile-contact";

export const prismaProfileContactRepository: ProfileContactRepository = {
  async findContact(userId) {
    const profile = await database.userProfile.findUnique({
      where: { userId },
      select: { phoneE164: true, user: { select: { email: true } } },
    });
    return profile === null
      ? null
      : { email: profile.user.email, phoneE164: profile.phoneE164 };
  },

  async shareAgreement(firstUserId, secondUserId) {
    const agreement = await database.agreement.findFirst({
      where: {
        OR: [
          { clientId: firstUserId, providerId: secondUserId },
          { clientId: secondUserId, providerId: firstUserId },
        ],
      },
      select: { id: true },
    });
    return agreement !== null;
  },

  async hasOfferTo(providerId, clientId) {
    const bid = await database.bid.findFirst({
      where: { providerId, withdrawnAt: null, tender: { ownerId: clientId } },
      select: { id: true },
    });
    return bid !== null;
  },

  async listVisibleTenderIds(ownerId) {
    const tenders = await database.tender.findMany({
      where: { ownerId, status: { not: "DRAFT" } },
      select: { id: true },
    });
    return tenders.map((tender) => tender.id);
  },

  listEntitlements: (providerId) =>
    prismaEntitlementRepository.listEntitlements(providerId),
};
