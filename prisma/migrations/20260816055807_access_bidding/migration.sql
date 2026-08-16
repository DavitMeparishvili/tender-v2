-- CreateEnum
CREATE TYPE "EntitlementKind" AS ENUM ('SINGLE_TENDER', 'MONTHLY_PROVIDER', 'ANNUAL_PROVIDER', 'ADMIN_OVERRIDE');

-- CreateEnum
CREATE TYPE "PaymentEventStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('SUBMITTED', 'WINNER', 'LOST', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SelectionOutcome" AS ENUM ('WINNER_SELECTED', 'EXPIRED_NO_BIDS');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('PENDING_CONFIRMATION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TenderStatus" ADD VALUE 'CLOSED';
ALTER TYPE "TenderStatus" ADD VALUE 'EXPIRED';

-- CreateTable
CREATE TABLE "AccessEntitlement" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "kind" "EntitlementKind" NOT NULL,
    "tenderId" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "sourceEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "externalEventId" TEXT NOT NULL,
    "checkoutId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "tenderId" TEXT,
    "amountMinorUnits" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PaymentEventStatus" NOT NULL DEFAULT 'PENDING',
    "rawPayload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("externalEventId")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "amountMinorUnits" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "BidStatus" NOT NULL DEFAULT 'SUBMITTED',
    "proposedStartDate" TIMESTAMP(3),
    "durationDays" INTEGER,
    "includedCosts" TEXT,
    "exclusions" TEXT,
    "conditions" TEXT NOT NULL,
    "qualifyingSubmittedAt" TIMESTAMP(3) NOT NULL,
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderSelection" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "outcome" "SelectionOutcome" NOT NULL,
    "winningBidId" TEXT,
    "agreementId" TEXT,
    "ranAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenderSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agreement" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "bidId" TEXT NOT NULL,
    "status" "AgreementStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "amountMinorUnits" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "tenderTitle" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "confirmDeadline" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessEntitlement_sourceEventId_key" ON "AccessEntitlement"("sourceEventId");

-- CreateIndex
CREATE INDEX "AccessEntitlement_providerId_kind_expiresAt_idx" ON "AccessEntitlement"("providerId", "kind", "expiresAt");

-- CreateIndex
CREATE INDEX "AccessEntitlement_providerId_tenderId_idx" ON "AccessEntitlement"("providerId", "tenderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_checkoutId_key" ON "PaymentEvent"("checkoutId");

-- CreateIndex
CREATE INDEX "PaymentEvent_providerId_receivedAt_idx" ON "PaymentEvent"("providerId", "receivedAt");

-- CreateIndex
CREATE INDEX "Bid_tenderId_status_amountMinorUnits_qualifyingSubmittedAt__idx" ON "Bid"("tenderId", "status", "amountMinorUnits", "qualifyingSubmittedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Bid_tenderId_providerId_key" ON "Bid"("tenderId", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "TenderSelection_tenderId_key" ON "TenderSelection"("tenderId");

-- CreateIndex
CREATE UNIQUE INDEX "TenderSelection_winningBidId_key" ON "TenderSelection"("winningBidId");

-- CreateIndex
CREATE UNIQUE INDEX "TenderSelection_agreementId_key" ON "TenderSelection"("agreementId");

-- CreateIndex
CREATE UNIQUE INDEX "Agreement_tenderId_key" ON "Agreement"("tenderId");

-- CreateIndex
CREATE UNIQUE INDEX "Agreement_bidId_key" ON "Agreement"("bidId");

-- CreateIndex
CREATE INDEX "Agreement_clientId_status_idx" ON "Agreement"("clientId", "status");

-- CreateIndex
CREATE INDEX "Agreement_providerId_status_idx" ON "Agreement"("providerId", "status");

-- AddForeignKey
ALTER TABLE "AccessEntitlement" ADD CONSTRAINT "AccessEntitlement_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
