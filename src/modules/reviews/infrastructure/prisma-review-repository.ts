import { Prisma } from "../../../generated/prisma/client";
import { database } from "../../../infrastructure/db/client";
import type { AgreementReviewGateway } from "../../agreements/infrastructure/prisma-agreement-gateway";
import { prismaAgreementGateway } from "../../agreements/infrastructure/prisma-agreement-gateway";
import { OUTBOX_TOPICS } from "../../notifications/domain/outbox-topic";
import { prismaNotificationPublisher } from "../../notifications/infrastructure/prisma-outbox-gateway";
import { getProviderDisplayNames } from "../../profiles/application/get-provider-display-names";
import type { IdGenerator, Result } from "../../shared";
import {
  aggregatePublishedReviews,
  deriveOverallRating,
  type ReviewAggregate,
  type ReviewScores,
  type ValidatedReviewDraft,
} from "../domain/review";

export type ReviewView = Readonly<{
  id: string;
  agreementId: string;
  reviewerId: string;
  reviewedId: string;
  scores: ReviewScores;
  overall: number;
  comment: string;
  publishedAt: Date;
}>;

export type PublicReviewView = Readonly<{
  tenderTitle: string;
  reviewerDisplayName: string;
  scores: ReviewScores;
  overall: number;
  comment: string;
  publishedAt: Date;
}>;

export type ProfileReviewView = Readonly<{
  aggregate: ReviewAggregate;
  reviews: readonly PublicReviewView[];
}>;

export interface ReviewRepository {
  publish(
    agreementId: string,
    reviewerId: string,
    draft: ValidatedReviewDraft,
    ids: IdGenerator,
    now: Date,
  ): Promise<
    Result<
      ReviewView,
      | "AGREEMENT_NOT_FOUND"
      | "NOT_PARTICIPANT"
      | "AGREEMENT_NOT_COMPLETED"
      | "REVIEW_ALREADY_EXISTS"
    >
  >;
  getForProfile(reviewedId: string): Promise<ProfileReviewView>;
}

function scores(
  row: Readonly<{
    quality: number;
    deadline: number;
    communication: number;
    agreedPrice: number;
  }>,
): ReviewScores {
  return {
    quality: row.quality,
    deadline: row.deadline,
    communication: row.communication,
    agreedPrice: row.agreedPrice,
  };
}

function reviewView(
  row: Readonly<{
    id: string;
    agreementId: string;
    reviewerId: string;
    reviewedId: string;
    quality: number;
    deadline: number;
    communication: number;
    agreedPrice: number;
    comment: string;
    createdAt: Date;
  }>,
): ReviewView {
  const reviewScores = scores(row);
  return {
    id: row.id,
    agreementId: row.agreementId,
    reviewerId: row.reviewerId,
    reviewedId: row.reviewedId,
    scores: reviewScores,
    overall: deriveOverallRating(reviewScores),
    comment: row.comment,
    publishedAt: row.createdAt,
  };
}

export class PrismaReviewRepository implements ReviewRepository {
  constructor(
    private readonly agreements: AgreementReviewGateway = prismaAgreementGateway,
  ) {}

  async publish(
    agreementId: string,
    reviewerId: string,
    draft: ValidatedReviewDraft,
    ids: IdGenerator,
    now: Date,
  ) {
    try {
      return await database.$transaction(async (transaction) => {
        const agreement = await this.agreements.lockForReview(
          transaction,
          agreementId,
        );
        if (agreement === null)
          return { ok: false as const, error: "AGREEMENT_NOT_FOUND" as const };
        if (
          reviewerId !== agreement.clientId &&
          reviewerId !== agreement.providerId
        ) {
          return { ok: false as const, error: "NOT_PARTICIPANT" as const };
        }
        if (agreement.status !== "COMPLETED") {
          return {
            ok: false as const,
            error: "AGREEMENT_NOT_COMPLETED" as const,
          };
        }
        const reviewedId =
          reviewerId === agreement.clientId
            ? agreement.providerId
            : agreement.clientId;
        const created = await transaction.review.create({
          data: {
            id: ids.next(),
            agreementId,
            reviewerId,
            reviewedId,
            quality: draft.scores.quality,
            deadline: draft.scores.deadline,
            communication: draft.scores.communication,
            agreedPrice: draft.scores.agreedPrice,
            comment: draft.comment,
          },
        });
        await transaction.auditEvent.create({
          data: {
            id: ids.next(),
            actorId: reviewerId,
            action: "REVIEW_PUBLISHED",
            targetType: "Review",
            targetId: created.id,
            correlationId: agreementId,
            metadata: {},
          },
        });
        await prismaNotificationPublisher.publish(
          transaction,
          [
            {
              recipientId: reviewedId,
              topic: OUTBOX_TOPICS.reviewPublished,
              aggregateType: "Review",
              aggregateId: created.id,
              messageKey: "notifications.reviewPublished",
              variables: { tenderTitle: agreement.tenderTitle },
            },
          ],
          [{ outboxId: ids.next(), inboxId: ids.next() }],
          now,
        );
        return { ok: true as const, value: reviewView(created) };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        Array.isArray(error.meta?.target) &&
        error.meta.target.includes("agreementId") &&
        error.meta.target.includes("reviewerId")
      ) {
        return { ok: false as const, error: "REVIEW_ALREADY_EXISTS" as const };
      }
      throw error;
    }
  }

  async getForProfile(reviewedId: string): Promise<ProfileReviewView> {
    const rows = await database.review.findMany({
      where: { reviewedId, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      select: {
        reviewerId: true,
        quality: true,
        deadline: true,
        communication: true,
        agreedPrice: true,
        comment: true,
        createdAt: true,
        agreement: { select: { tenderTitle: true } },
      },
    });
    const names = await getProviderDisplayNames(
      rows.map((row) => row.reviewerId),
    );
    const reviews = rows.map((row) => {
      const reviewScores = scores(row);
      return {
        tenderTitle: row.agreement.tenderTitle,
        reviewerDisplayName: names.get(row.reviewerId) ?? "",
        scores: reviewScores,
        overall: deriveOverallRating(reviewScores),
        comment: row.comment,
        publishedAt: row.createdAt,
      };
    });
    return {
      aggregate: aggregatePublishedReviews(
        reviews.map((review) => ({
          status: "PUBLISHED" as const,
          scores: review.scores,
        })),
      ),
      reviews,
    };
  }
}

export const prismaReviewRepository = new PrismaReviewRepository();
