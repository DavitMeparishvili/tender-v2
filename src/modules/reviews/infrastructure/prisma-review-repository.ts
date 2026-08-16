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

export type ModerationReviewView = Readonly<{
  id: string;
  tenderTitle: string;
  reviewerDisplayName: string;
  reviewedDisplayName: string;
  scores: ReviewScores;
  overall: number;
  comment: string;
  status: "PUBLISHED" | "REDACTED";
  publishedAt: Date;
  redactedAt: Date | null;
  redactionReason: string | null;
}>;

export type RedactReviewResult = Readonly<{
  id: string;
  status: "PUBLISHED" | "REDACTED";
  changed: boolean;
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

export interface ReviewModerationRepository {
  redact(
    reviewId: string,
    reason: string,
    adminId: string,
    ids: IdGenerator,
    now: Date,
  ): Promise<Result<RedactReviewResult, "REVIEW_NOT_FOUND">>;
  listForModeration(): Promise<readonly ModerationReviewView[]>;
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

export class PrismaReviewRepository
  implements ReviewRepository, ReviewModerationRepository
{
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
        JSON.stringify(error.meta).includes("Review_agreementId_reviewerId_key")
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

  async getForAgreementReviewer(agreementId: string, reviewerId: string) {
    const row = await database.review.findUnique({
      where: { agreementId_reviewerId: { agreementId, reviewerId } },
    });
    return row === null ? null : reviewView(row);
  }

  async redact(
    reviewId: string,
    reason: string,
    adminId: string,
    ids: IdGenerator,
    now: Date,
  ): Promise<Result<RedactReviewResult, "REVIEW_NOT_FOUND">> {
    return database.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT "id" FROM "Review" WHERE "id" = ${reviewId} FOR UPDATE
      `;
      const review = await transaction.review.findUnique({
        where: { id: reviewId },
      });
      if (review === null)
        return { ok: false as const, error: "REVIEW_NOT_FOUND" as const };
      if (review.status === "REDACTED") {
        return {
          ok: true as const,
          value: { id: review.id, status: "REDACTED" as const, changed: false },
        };
      }
      const updated = await transaction.review.update({
        where: { id: reviewId },
        data: {
          status: "REDACTED",
          redactedAt: now,
          redactedById: adminId,
          redactionReason: reason,
        },
      });
      await transaction.auditEvent.create({
        data: {
          id: ids.next(),
          actorId: adminId,
          action: "REVIEW_REDACTED",
          targetType: "Review",
          targetId: reviewId,
          reason,
          correlationId: reviewId,
          metadata: {},
        },
      });
      await prismaNotificationPublisher.publish(
        transaction,
        [
          {
            recipientId: review.reviewerId,
            topic: OUTBOX_TOPICS.reviewRedacted,
            aggregateType: "Review",
            aggregateId: reviewId,
            messageKey: "notifications.reviewRedacted",
            variables: { tenderTitle: "" },
          },
        ],
        [{ outboxId: ids.next(), inboxId: ids.next() }],
        now,
      );
      return {
        ok: true as const,
        value: { id: updated.id, status: "REDACTED" as const, changed: true },
      };
    });
  }

  async listForModeration(): Promise<readonly ModerationReviewView[]> {
    const rows = await database.review.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        reviewerId: true,
        reviewedId: true,
        quality: true,
        deadline: true,
        communication: true,
        agreedPrice: true,
        comment: true,
        status: true,
        createdAt: true,
        redactedAt: true,
        redactionReason: true,
        agreement: { select: { tenderTitle: true } },
      },
    });
    const names = await getProviderDisplayNames(
      rows.flatMap((row) => [row.reviewerId, row.reviewedId]),
    );
    return rows.map((row) => {
      const reviewScores = scores(row);
      return {
        id: row.id,
        tenderTitle: row.agreement.tenderTitle,
        reviewerDisplayName: names.get(row.reviewerId) ?? "",
        reviewedDisplayName: names.get(row.reviewedId) ?? "",
        scores: reviewScores,
        overall: deriveOverallRating(reviewScores),
        comment: row.comment,
        status: row.status,
        publishedAt: row.createdAt,
        redactedAt: row.redactedAt,
        redactionReason: row.redactionReason,
      };
    });
  }
}

export const prismaReviewRepository = new PrismaReviewRepository();
