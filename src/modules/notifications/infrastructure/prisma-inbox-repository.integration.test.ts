import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { prismaInboxRepository } from "./prisma-inbox-repository";

async function user(): Promise<string> {
  const id = randomUUID();
  await database.user.create({
    data: {
      id,
      name: "Inbox user",
      email: `${id}@tender.test`,
      emailVerified: true,
    },
  });
  return id;
}

describe("PrismaInboxRepository", () => {
  it("lists only recipient items and preserves the first read time", async () => {
    const recipientId = await user();
    const outsiderId = await user();
    const id = randomUUID();
    await database.inboxNotification.createMany({
      data: [
        {
          id,
          recipientId,
          topic: "AGREEMENT_AGREED",
          aggregateType: "Agreement",
          aggregateId: "agreement",
          messageKey: "notifications.agreementAgreed",
          variables: {},
        },
        {
          id: randomUUID(),
          recipientId: outsiderId,
          topic: "AGREEMENT_AGREED",
          aggregateType: "Agreement",
          aggregateId: "other",
          messageKey: "notifications.agreementAgreed",
          variables: {},
        },
      ],
    });
    await expect(prismaInboxRepository.list(recipientId)).resolves.toHaveLength(
      1,
    );
    const first = await prismaInboxRepository.markRead(
      id,
      recipientId,
      new Date("2026-08-16T12:00:00Z"),
    );
    if (!first.ok) throw new Error("expected item");
    const retry = await prismaInboxRepository.markRead(
      id,
      recipientId,
      new Date("2026-08-16T13:00:00Z"),
    );
    expect(retry).toEqual(first);
    await expect(
      prismaInboxRepository.markRead(id, outsiderId, new Date()),
    ).resolves.toEqual({ ok: false, error: "NOTIFICATION_NOT_FOUND" });
  });
});
afterAll(async () => database.$disconnect());
