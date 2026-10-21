-- TM-8 data step. The old deadline selector closed a tender by marking every
-- non-winning offer LOST at the moment it created the pending agreement. Under
-- the new rule those offers stay SUBMITTED ("on standby") until the agreement
-- is agreed, so that a declined or expired agreement can send the client back
-- to choose among them.
--
-- For every CLOSED tender whose LATEST agreement is still awaiting
-- confirmation, put its non-withdrawn LOST offers back on standby. Offers that
-- were themselves the subject of any agreement (a former winner) are left
-- alone, so the statement is idempotent: re-running it changes nothing.
UPDATE "Bid" AS b
SET "status" = 'SUBMITTED'
FROM "Tender" AS t
WHERE b."tenderId" = t."id"
  AND t."status" = 'CLOSED'
  AND b."status" = 'LOST'
  AND b."withdrawnAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Agreement" AS own WHERE own."bidId" = b."id"
  )
  AND EXISTS (
    SELECT 1
    FROM "Agreement" AS latest
    WHERE latest."tenderId" = t."id"
      AND latest."status" = 'PENDING_CONFIRMATION'
      AND NOT EXISTS (
        SELECT 1
        FROM "Agreement" AS newer
        WHERE newer."tenderId" = t."id"
          AND (newer."createdAt", newer."id") > (latest."createdAt", latest."id")
      )
  );
