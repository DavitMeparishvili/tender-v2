import type { Prisma } from "../../../generated/prisma/client";
import type { OutboxDraft } from "../domain/outbox-topic";

// Written inside the caller's transaction so a notification cannot exist for
// a state change that rolled back, and a state change cannot commit without
// its notification — the transactional-outbox guarantee the program design
// requires (§3.1).
export interface OutboxGateway {
  enqueue(
    transaction: Prisma.TransactionClient,
    drafts: readonly OutboxDraft[],
    ids: readonly string[],
    now: Date,
  ): Promise<void>;
}

export class PrismaOutboxGateway implements OutboxGateway {
  async enqueue(
    transaction: Prisma.TransactionClient,
    drafts: readonly OutboxDraft[],
    ids: readonly string[],
    now: Date,
  ): Promise<void> {
    if (drafts.length === 0) return;
    if (ids.length !== drafts.length) {
      throw new Error(
        `Outbox enqueue needs one id per draft (${drafts.length} drafts, ${ids.length} ids).`,
      );
    }
    await transaction.outboxMessage.createMany({
      data: drafts.map((draft, index) => ({
        id: ids[index]!,
        topic: draft.topic,
        aggregateId: draft.aggregateId,
        payload: draft.payload as unknown as Prisma.InputJsonValue,
        // Available immediately: Phase 5 introduces the delivery worker and
        // may schedule retries into the future by moving this forward.
        availableAt: now,
      })),
    });
  }
}

export const prismaOutboxGateway = new PrismaOutboxGateway();
