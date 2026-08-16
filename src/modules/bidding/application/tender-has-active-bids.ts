export interface BidPresenceRepository {
  countActiveBids(tenderId: string): Promise<number>;
}

export function createTenderHasActiveBids(dependencies: {
  repository: BidPresenceRepository;
}) {
  return async function tenderHasActiveBids(
    tenderId: string,
  ): Promise<boolean> {
    return (await dependencies.repository.countActiveBids(tenderId)) > 0;
  };
}

// The published cross-module query `tenders` binds to its `BidPresence` port
// so a client cannot cancel a tender providers have already competed for.
export async function tenderHasActiveBids(tenderId: string): Promise<boolean> {
  const { prismaBidRepository } =
    await import("../infrastructure/prisma-bid-repository");
  return createTenderHasActiveBids({ repository: prismaBidRepository })(
    tenderId,
  );
}
