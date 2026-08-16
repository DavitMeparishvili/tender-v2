import type { Prisma } from "../../../generated/prisma/client";
import type { NotificationDraft } from "../domain/outbox-topic";

export type NotificationIds = Readonly<{ outboxId: string; inboxId: string }>;

export interface NotificationPublisher {
  publish(
    transaction: Prisma.TransactionClient,
    drafts: readonly NotificationDraft[],
    ids: readonly NotificationIds[],
    now: Date,
  ): Promise<void>;
}

export class PrismaNotificationPublisher implements NotificationPublisher {
  async publish(
    transaction: Prisma.TransactionClient,
    drafts: readonly NotificationDraft[],
    ids: readonly NotificationIds[],
    now: Date,
  ): Promise<void> {
    if (drafts.length === 0) return;
    if (ids.length !== drafts.length) {
      throw new Error(
        `Notification publish needs one id pair per draft (${drafts.length} drafts, ${ids.length} id pairs).`,
      );
    }
    await transaction.outboxMessage.createMany({
      data: drafts.map((draft, index) => ({
        id: ids[index]!.outboxId,
        topic: draft.topic,
        aggregateId: draft.aggregateId,
        payload: {
          recipientId: draft.recipientId,
          aggregateType: draft.aggregateType,
          messageKey: draft.messageKey,
          variables: draft.variables,
        } as Prisma.InputJsonValue,
        availableAt: now,
      })),
    });
    await transaction.inboxNotification.createMany({
      data: drafts.map((draft, index) => ({
        id: ids[index]!.inboxId,
        recipientId: draft.recipientId,
        topic: draft.topic,
        aggregateType: draft.aggregateType,
        aggregateId: draft.aggregateId,
        messageKey: draft.messageKey,
        variables: draft.variables as Prisma.InputJsonValue,
        createdAt: now,
      })),
    });
  }
}

export const prismaNotificationPublisher = new PrismaNotificationPublisher();
