import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { Prisma } from "../../../generated/prisma/client";
import { PrismaTenderRepository } from "../../tenders/infrastructure/prisma-tender-repository";
import { PrismaBidRepository } from "./prisma-bid-repository";

// A held row lock and PostgreSQL's waiter visibility establish ordering without
// relying on arbitrary sleeps. Tests use only disposable records in _test.
async function waitForLockWaiters(count: number) {
  const until = Date.now() + 3000;
  while (Date.now() < until) {
    const rows = await database.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT count(*) FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'
      AND query LIKE '%FROM "Tender"%FOR UPDATE%'
    `);
    if (Number(rows[0]?.count) >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Expected ${count} Tender lock waiters`);
}

describe("serialized cancellation and submission", () => {
  for (const first of ["cancel", "submit", "deadline"] as const) {
    it(`rechecks state after lock acquisition: ${first} first`, async () => {
      const ownerId = randomUUID(),
        providerId = randomUUID(),
        tenderId = randomUUID();
      const deadline = new Date(Date.now() + 86_400_000);
      await database.user.createMany({
        data: [ownerId, providerId].map((id) => ({
          id,
          name: "Race test",
          email: `${id}@tender.test`,
          emailVerified: true,
        })),
      });
      try {
        await database.tender.create({
          data: {
            id: tenderId,
            ownerId,
            title: "Race test",
            status: "PUBLISHED",
            specialty: "CONSTRUCTION_REPAIR",
            serviceCode: "GENERAL_CONSTRUCTION",
            deadline,
          },
        });
        const bids = new PrismaBidRepository(),
          tenders = new PrismaTenderRepository();
        const submit = () =>
          bids.insertBid(
            {
              id: randomUUID(),
              tenderId,
              providerId,
              amountMinorUnits: 10000,
              currency: "GEL",
              command: {
                amountMinorUnits: 10000,
                conditions: "All labour and materials included.",
              },
              qualifyingSubmittedAt: new Date(),
            },
            deadline,
          );
        const cancel = () =>
          tenders.cancel(
            tenderId,
            { reason: "Example cancellation" },
            { id: ownerId },
            new Date(),
          );
        let submission!: ReturnType<typeof submit>;
        let cancellation: ReturnType<typeof cancel> | undefined;
        await database.$transaction(
          async (tx) => {
            await tx.$queryRaw(
              Prisma.sql`SELECT "id" FROM "Tender" WHERE "id" = ${tenderId} FOR UPDATE`,
            );
            if (first === "deadline") {
              await tx.tender.update({
                where: { id: tenderId },
                data: { deadline: new Date(Date.now() - 1000) },
              });
              submission = submit();
              await waitForLockWaiters(1);
            } else if (first === "cancel") {
              cancellation = cancel();
              await waitForLockWaiters(1);
              submission = submit();
              await waitForLockWaiters(2);
            } else {
              submission = submit();
              await waitForLockWaiters(1);
              cancellation = cancel();
              await waitForLockWaiters(2);
            }
          },
          { timeout: 10000 },
        );
        const [submitted, cancelled] = await Promise.all([
          submission,
          cancellation,
        ]);
        if (first === "cancel") {
          expect(cancelled?.ok).toBe(true);
          expect(submitted).toEqual({ ok: false, error: "TENDER_NOT_OPEN" });
          expect(await database.bid.count({ where: { tenderId } })).toBe(0);
        } else if (first === "submit") {
          expect(submitted.ok).toBe(true);
          expect(cancelled).toEqual({ ok: false, error: "TENDER_HAS_BIDS" });
          expect(
            (
              await database.tender.findUniqueOrThrow({
                where: { id: tenderId },
              })
            ).status,
          ).toBe("PUBLISHED");
        } else {
          expect(submitted).toEqual({ ok: false, error: "DEADLINE_PASSED" });
          expect(await database.bid.count({ where: { tenderId } })).toBe(0);
        }
      } finally {
        await database.tender.deleteMany({ where: { id: tenderId } });
        await database.user.deleteMany({
          where: { id: { in: [ownerId, providerId] } },
        });
      }
    });
  }
});
