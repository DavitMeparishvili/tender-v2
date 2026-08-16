import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { OUTBOX_TOPICS, type NotificationDraft } from "../domain/outbox-topic";
import { prismaNotificationPublisher } from "./prisma-outbox-gateway";

async function seedRecipient(): Promise<string> {
  const id = randomUUID();
  await database.user.create({
    data: {
      id,
      name: "Inbox recipient",
      email: `${id}@tender.test`,
      emailVerified: true,
    },
  });
  return id;
}

describe("PrismaNotificationPublisher", () => {
  it("writes matching outbox and inbox records in its caller transaction", async () => {
    const recipientId = await seedRecipient();
    const agreementId = randomUUID();
    const now = new Date();
    const draft: NotificationDraft = {
      recipientId,
      topic: OUTBOX_TOPICS.agreementAgreed,
      aggregateType: "Agreement",
      aggregateId: agreementId,
      messageKey: "notifications.agreementAgreed",
      variables: { agreementId, tenderTitle: "Kitchen renovation" },
    };
    await database.$transaction((transaction) =>
      prismaNotificationPublisher.publish(
        transaction,
        [draft],
        [{ outboxId: randomUUID(), inboxId: randomUUID() }],
        now,
      ),
    );
    await expect(
      database.outboxMessage.count({ where: { aggregateId: agreementId } }),
    ).resolves.toBe(1);
    await expect(
      database.inboxNotification.count({
        where: { recipientId, aggregateId: agreementId },
      }),
    ).resolves.toBe(1);
  });

  it("rolls both writes back with the surrounding transaction", async () => {
    const recipientId = await seedRecipient();
    const agreementId = randomUUID();
    const draft: NotificationDraft = {
      recipientId,
      topic: OUTBOX_TOPICS.agreementAgreed,
      aggregateType: "Agreement",
      aggregateId: agreementId,
      messageKey: "notifications.agreementAgreed",
      variables: { agreementId },
    };
    await expect(
      database.$transaction(async (transaction) => {
        await prismaNotificationPublisher.publish(
          transaction,
          [draft],
          [{ outboxId: randomUUID(), inboxId: randomUUID() }],
          new Date(),
        );
        throw new Error("force rollback");
      }),
    ).rejects.toThrow("force rollback");
    await expect(
      database.outboxMessage.count({ where: { aggregateId: agreementId } }),
    ).resolves.toBe(0);
    await expect(
      database.inboxNotification.count({ where: { aggregateId: agreementId } }),
    ).resolves.toBe(0);
  });

  it("rejects mismatched draft and identifier counts", async () => {
    const recipientId = await seedRecipient();
    const draft: NotificationDraft = {
      recipientId,
      topic: OUTBOX_TOPICS.agreementAgreed,
      aggregateType: "Agreement",
      aggregateId: randomUUID(),
      messageKey: "notifications.agreementAgreed",
      variables: {},
    };
    await expect(
      database.$transaction((transaction) =>
        prismaNotificationPublisher.publish(
          transaction,
          [draft],
          [],
          new Date(),
        ),
      ),
    ).rejects.toThrow("one id pair");
  });
});

afterAll(async () => database.$disconnect());
