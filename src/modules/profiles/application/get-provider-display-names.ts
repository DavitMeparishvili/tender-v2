export interface ProviderDisplayNameRepository {
  findDisplayNames(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>>;
}

export function createGetProviderDisplayNames(dependencies: {
  repository: ProviderDisplayNameRepository;
}) {
  return async function getProviderDisplayNames(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    if (userIds.length === 0) return new Map();
    return dependencies.repository.findDisplayNames(userIds);
  };
}

export async function getProviderDisplayNames(
  userIds: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  const { prismaProfileRepository } =
    await import("../infrastructure/prisma-profile-repository");
  return createGetProviderDisplayNames({
    repository: prismaProfileRepository,
  })(userIds);
}
