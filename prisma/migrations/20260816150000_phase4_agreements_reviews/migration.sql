/*
  Warnings:

*/
-- CreateEnum
CREATE TYPE "AgreementCancellationReasonCode" AS ENUM ('PARTY_DECLINED', 'SCHEDULE_CHANGED', 'SCOPE_CANNOT_PROCEED', 'OTHER', 'CONFIRMATION_EXPIRED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'REDACTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AgreementStatus" ADD VALUE 'AGREED';
ALTER TYPE "AgreementStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "AgreementStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "AgreementStatus" ADD VALUE 'CANCELLED';

-- DropIndex
DROP INDEX "Agreement_clientId_status_idx";

-- DropIndex
DROP INDEX "Agreement_providerId_status_idx";

-- AlterTable
ALTER TABLE "Agreement" ADD COLUMN     "cancellationExplanation" TEXT,
ADD COLUMN     "cancellationReasonCode" "AgreementCancellationReasonCode",
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" TEXT,
ADD COLUMN     "clientCompletedAt" TIMESTAMP(3),
ADD COLUMN     "clientConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "clientStartedAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "providerCompletedAt" TIMESTAMP(3),
ADD COLUMN     "providerConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "providerStartedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Existing Phase 3 snapshots have no lifecycle fields. Retain them as
-- pending records and backfill only the new bookkeeping timestamp.
UPDATE "Agreement" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "Agreement" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateTable
CREATE TABLE "InboxNotification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "messageKey" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewedId" TEXT NOT NULL,
    "quality" INTEGER NOT NULL,
    "deadline" INTEGER NOT NULL,
    "communication" INTEGER NOT NULL,
    "agreedPrice" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "redactedAt" TIMESTAMP(3),
    "redactedById" TEXT,
    "redactionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InboxNotification_recipientId_createdAt_idx" ON "InboxNotification"("recipientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "InboxNotification_recipientId_readAt_createdAt_idx" ON "InboxNotification"("recipientId", "readAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Review_reviewedId_status_createdAt_idx" ON "Review"("reviewedId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Review_status_createdAt_idx" ON "Review"("status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Review_agreementId_reviewerId_key" ON "Review"("agreementId", "reviewerId");

-- CreateIndex
CREATE INDEX "Agreement_clientId_status_updatedAt_idx" ON "Agreement"("clientId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Agreement_providerId_status_updatedAt_idx" ON "Agreement"("providerId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Agreement_status_confirmDeadline_idx" ON "Agreement"("status", "confirmDeadline");

-- AddForeignKey
-- Earlier Phase 3 development data can contain intentionally orphaned
-- snapshots after fixture cleanup. Keep those immutable records readable;
-- PostgreSQL enforces these keys for every new or changed row.
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "InboxNotification" ADD CONSTRAINT "InboxNotification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewedId_fkey" FOREIGN KEY ("reviewedId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_quality_range" CHECK ("quality" BETWEEN 1 AND 5),
  ADD CONSTRAINT "Review_deadline_range" CHECK ("deadline" BETWEEN 1 AND 5),
  ADD CONSTRAINT "Review_communication_range" CHECK ("communication" BETWEEN 1 AND 5),
  ADD CONSTRAINT "Review_agreedPrice_range" CHECK ("agreedPrice" BETWEEN 1 AND 5),
  ADD CONSTRAINT "Review_distinct_parties" CHECK ("reviewerId" <> "reviewedId");

ALTER TABLE "Agreement"
  ADD CONSTRAINT "Agreement_cancellation_coherent" CHECK (
    (
      "status" = 'CANCELLED'
      AND "cancelledAt" IS NOT NULL
      AND (
        (
          "cancellationReasonCode" = 'CONFIRMATION_EXPIRED'
          AND "cancelledById" IS NULL
          AND "cancellationExplanation" IS NULL
        )
        OR
        (
          "cancellationReasonCode" <> 'CONFIRMATION_EXPIRED'
          AND "cancelledById" IN ("clientId", "providerId")
          AND "cancellationExplanation" IS NOT NULL
        )
      )
    )
    OR
    (
      "status" <> 'CANCELLED'
      AND "cancelledAt" IS NULL
      AND "cancelledById" IS NULL
      AND "cancellationReasonCode" IS NULL
      AND "cancellationExplanation" IS NULL
    )
  );
