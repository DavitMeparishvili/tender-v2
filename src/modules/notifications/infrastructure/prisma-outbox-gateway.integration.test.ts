import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { OUTBOX_TOPICS } from "../domain/outbox-topic";
import { prismaOutboxGateway } from "./prisma-outbox-gateway";

afterAll(async () => {
  await database.$disconnect();
});

describe("prismaOutboxGateway", () => {
  it("writes every draft inside the caller's transaction", async () => {
    const aggregateId = randomUUID();
    const ids = [randomUUID(), randomUUID()];

    await database.$transaction((transaction) =>
      prismaOutboxGateway.enqueue(
        transaction,
        [
          {
            topic: OUTBOX_TOPICS.bidWon,
            aggregateId,
            payload: { bidId: "bid-1" },
          },
          {
            topic: OUTBOX_TOPICS.bidLost,
            aggregateId,
            payload: { bidId: "bid-2" },
          },
        ],
        ids,
        new Date(),
      ),
    );

    const written = await database.outboxMessage.findMany({
      where: { aggregateId },
      orderBy: { topic: "asc" },
      select: { topic: true, processedAt: true },
    });
    expect(written).toEqual([
      { topic: "BID_LOST", processedAt: null },
      { topic: "BID_WON", processedAt: null },
    ]);
  });

  it("writes nothing when the caller's transaction rolls back", async () => {
    const aggregateId = randomUUID();

    await expect(
      database.$transaction(async (transaction) => {
        await prismaOutboxGateway.enqueue(
          transaction,
          [
            {
              topic: OUTBOX_TOPICS.tenderWinnerSelected,
              aggregateId,
              payload: {},
            },
          ],
          [randomUUID()],
          new Date(),
        );
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");

    await expect(
      database.outboxMessage.count({ where: { aggregateId } }),
    ).resolves.toBe(0);
  });
});
