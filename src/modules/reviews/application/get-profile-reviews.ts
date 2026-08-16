import type {
  ProfileReviewView,
  ReviewRepository,
} from "../infrastructure/prisma-review-repository";

export function createGetProfileReviews(
  dependencies: Readonly<{
    repository: ReviewRepository;
  }>,
) {
  return (userId: string): Promise<ProfileReviewView> =>
    dependencies.repository.getForProfile(userId);
}

export async function getProfileReviews(userId: string) {
  const { prismaReviewRepository } =
    await import("../infrastructure/prisma-review-repository");
  return createGetProfileReviews({ repository: prismaReviewRepository })(
    userId,
  );
}
