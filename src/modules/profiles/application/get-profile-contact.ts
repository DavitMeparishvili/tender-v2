import { isActiveEntitlement } from "../../access/domain/disclosure-policy";
import type { Entitlement } from "../../access/domain/entitlement";
import type { Clock } from "../../shared";

export type ProfileContact = Readonly<{
  email: string;
  phoneE164: string;
}>;

export interface ProfileContactRepository {
  findContact(userId: string): Promise<ProfileContact | null>;
  shareAgreement(firstUserId: string, secondUserId: string): Promise<boolean>;
  // A live (not withdrawn) offer from the provider on a tender the client owns.
  hasOfferTo(providerId: string, clientId: string): Promise<boolean>;
  // Tenders providers can see, so paid access to them can disclose the owner.
  listVisibleTenderIds(ownerId: string): Promise<readonly string[]>;
  listEntitlements(providerId: string): Promise<readonly Entitlement[]>;
}

// Contacts stay private unless the viewer is connected to the profile:
// - the profile owner always sees their own;
// - the two parties of any agreement see each other's;
// - a client sees a contractor who sent an offer to one of their tenders;
// - a contractor with paid access to one of the client's tenders sees the
//   client, the same rule that discloses the client on the tender page.
export function createGetProfileContact(
  dependencies: Readonly<{
    repository: ProfileContactRepository;
    clock: Clock;
  }>,
) {
  const { repository } = dependencies;

  async function isConnected(
    viewerId: string,
    profileUserId: string,
  ): Promise<boolean> {
    if (viewerId === profileUserId) return true;
    const [agreement, offer] = await Promise.all([
      repository.shareAgreement(viewerId, profileUserId),
      repository.hasOfferTo(profileUserId, viewerId),
    ]);
    if (agreement || offer) return true;

    const entitlements = await repository.listEntitlements(viewerId);
    if (entitlements.length === 0) return false;
    const tenderIds = await repository.listVisibleTenderIds(profileUserId);
    const now = dependencies.clock.now();
    return tenderIds.some((tenderId) =>
      entitlements.some((entitlement) =>
        isActiveEntitlement(
          entitlement,
          { providerId: viewerId, tenderId },
          now,
        ),
      ),
    );
  }

  return async function getProfileContact(
    profileUserId: string,
    viewer: Readonly<{ id: string }> | null,
  ): Promise<ProfileContact | null> {
    if (viewer === null) return null;
    if (!(await isConnected(viewer.id, profileUserId))) return null;
    return repository.findContact(profileUserId);
  };
}

export async function getProfileContact(
  profileUserId: string,
  viewer: Readonly<{ id: string }> | null,
): Promise<ProfileContact | null> {
  const { prismaProfileContactRepository } =
    await import("../infrastructure/prisma-profile-contact-repository");
  return createGetProfileContact({
    repository: prismaProfileContactRepository,
    clock: { now: () => new Date() },
  })(profileUserId, viewer);
}
