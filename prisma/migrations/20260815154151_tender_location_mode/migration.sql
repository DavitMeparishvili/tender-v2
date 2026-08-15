-- CreateEnum
CREATE TYPE "TenderLocationMode" AS ENUM ('ADDRESS', 'PIN');

-- AlterTable
ALTER TABLE "Tender" ADD COLUMN     "locationMode" "TenderLocationMode";

-- Backfill: rows written before this column existed still have to resume in
-- the mode their client used, or the authoring wizard reopens them in the
-- wrong branch and overwrites the address (or the pin) they carry.
--
-- The mode is recoverable exactly for the data this system wrote: a pin-located
-- tender stores the stub geocoder's reverse-geocoded label, whose shape is
-- literally `Near <city>, Georgia`, while an address-located tender stores the
-- street address the client typed. Rows with no location keep a NULL mode.
UPDATE "Tender"
SET "locationMode" = CASE
    WHEN "addressLine" LIKE 'Near %, Georgia' THEN 'PIN'::"TenderLocationMode"
    ELSE 'ADDRESS'::"TenderLocationMode"
  END
WHERE "city" IS NOT NULL
  AND "addressLine" IS NOT NULL
  AND "exactLatitude" IS NOT NULL
  AND "exactLongitude" IS NOT NULL;
