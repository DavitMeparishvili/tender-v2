-- CreateEnum
CREATE TYPE "TenderStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Tender" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "TenderStatus" NOT NULL DEFAULT 'DRAFT',
    "specialty" "ProviderSpecialtyCode" NOT NULL,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT,
    "fullDescription" TEXT,
    "scopeOfWork" TEXT,
    "budgetMinorUnits" INTEGER,
    "currency" TEXT,
    "desiredStartDate" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "workerNotes" TEXT,
    "equipmentNotes" TEXT,
    "materialNotes" TEXT,
    "countryCode" TEXT,
    "city" TEXT,
    "district" TEXT,
    "addressLine" TEXT,
    "exactLatitude" DOUBLE PRECISION,
    "exactLongitude" DOUBLE PRECISION,
    "publicLatitude" DOUBLE PRECISION,
    "publicLongitude" DOUBLE PRECISION,
    "conditions" TEXT,
    "publishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenderAttachment" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenderAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tender_ownerId_status_idx" ON "Tender"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Tender_status_specialty_city_deadline_idx" ON "Tender"("status", "specialty", "city", "deadline");

-- CreateIndex
CREATE UNIQUE INDEX "TenderAttachment_objectKey_key" ON "TenderAttachment"("objectKey");

-- CreateIndex
CREATE INDEX "TenderAttachment_tenderId_idx" ON "TenderAttachment"("tenderId");

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenderAttachment" ADD CONSTRAINT "TenderAttachment_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
