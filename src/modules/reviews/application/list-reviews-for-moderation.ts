import type {
  ModerationReviewView,
  ReviewModerationRepository,
} from "../infrastructure/prisma-review-repository";

export function createListReviewsForModeration(
  dependencies: Readonly<{
    repository: ReviewModerationRepository;
  }>,
) {
  return (): Promise<readonly ModerationReviewView[]> =>
    dependencies.repository.listForModeration();
}

export async function listReviewsForModeration() {
  const { prismaReviewRepository } =
    await import("../infrastructure/prisma-review-repository");
  return createListReviewsForModeration({
    repository: prismaReviewRepository,
  })();
}
