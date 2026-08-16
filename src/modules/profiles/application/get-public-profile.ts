import type { Result } from "../../shared";

export type PublicProfileView = Readonly<{
  userId: string;
  displayName: string;
  accountKind: "PERSON" | "COMPANY";
  city: string;
  activityDescription: string;
  providerSpecialties: readonly "CONSTRUCTION_REPAIR"[];
}>;

export interface PublicProfileRepository {
  getPublic(
    userId: string,
  ): Promise<Result<PublicProfileView, "PROFILE_NOT_FOUND">>;
}

export function createGetPublicProfile(
  dependencies: Readonly<{
    repository: PublicProfileRepository;
  }>,
) {
  return (userId: string) => dependencies.repository.getPublic(userId);
}

export async function getPublicProfile(userId: string) {
  const { prismaProfileRepository } =
    await import("../infrastructure/prisma-profile-repository");
  return createGetPublicProfile({ repository: prismaProfileRepository })(
    userId,
  );
}
