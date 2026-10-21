export interface TenderOwnershipRepository {
  isOwnedBy(tenderId: string, userId: string): Promise<boolean>;
}

export function createIsTenderOwnedBy(repository: TenderOwnershipRepository) {
  return (tenderId: string, userId: string) =>
    repository.isOwnedBy(tenderId, userId);
}

// Answers only yes/no so the owner id never has to travel on the masked
// public detail DTO.
export async function isTenderOwnedBy(
  tenderId: string,
  userId: string,
): Promise<boolean> {
  const { prismaTenderRepository } =
    await import("../infrastructure/prisma-tender-repository");
  return createIsTenderOwnedBy(prismaTenderRepository)(tenderId, userId);
}
