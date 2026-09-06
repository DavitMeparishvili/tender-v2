-- Existing accounts predate these required registration fields, so the
-- columns remain nullable for historical rows. Better Auth requires both on
-- every new email registration.
ALTER TABLE "user"
ADD COLUMN "idNumber" TEXT,
ADD COLUMN "address" TEXT;
