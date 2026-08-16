import type { ReviewView } from "../infrastructure/prisma-review-repository";

export interface AgreementReviewLookup {
  getForAgreementReviewer(
    agreementId: string,
    reviewerId: string,
  ): Promise<ReviewView | null>;
}

export function createGetAgreementReview(
  dependencies: Readonly<{
    repository: AgreementReviewLookup;
  }>,
) {
  return (agreementId: string, actor: Readonly<{ id: string }>) =>
    dependencies.repository.getForAgreementReviewer(agreementId, actor.id);
}

export async function getAgreementReview(
  agreementId: string,
  actor: Readonly<{ id: string }>,
) {
  const { prismaReviewRepository } =
    await import("../infrastructure/prisma-review-repository");
  return createGetAgreementReview({ repository: prismaReviewRepository })(
    agreementId,
    actor,
  );
}
