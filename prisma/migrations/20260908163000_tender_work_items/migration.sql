ALTER TABLE "Tender" ADD COLUMN "workItems" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "areaSquareMeters" DOUBLE PRECISION,
ADD COLUMN "reference" TEXT;
CREATE UNIQUE INDEX "Tender_reference_key" ON "Tender"("reference");
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_area_positive" CHECK ("areaSquareMeters" IS NULL OR "areaSquareMeters" > 0);
