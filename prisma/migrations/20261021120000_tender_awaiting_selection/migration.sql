-- AlterEnum
ALTER TYPE "TenderStatus" ADD VALUE 'AWAITING_SELECTION';

-- AlterEnum
ALTER TYPE "SelectionOutcome" ADD VALUE 'SELECTION_EXPIRED';

-- DropIndex
DROP INDEX "TenderSelection_tenderId_key";

-- DropIndex
DROP INDEX "Agreement_tenderId_key";

-- AlterTable
ALTER TABLE "Tender" ADD COLUMN     "selectionExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Tender_status_selectionExpiresAt_idx" ON "Tender"("status", "selectionExpiresAt");

-- CreateIndex
CREATE INDEX "TenderSelection_tenderId_ranAt_idx" ON "TenderSelection"("tenderId", "ranAt");

-- CreateIndex
CREATE INDEX "Agreement_tenderId_createdAt_idx" ON "Agreement"("tenderId", "createdAt");

