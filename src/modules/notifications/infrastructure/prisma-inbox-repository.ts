import { database } from "../../../infrastructure/db/client";
import type { Result } from "../../shared";
export type InboxItem = Readonly<{
  id: string;
  topic: string;
  aggregateType: string;
  aggregateId: string;
  messageKey: string;
  variables: Readonly<Record<string, string | number | null>>;
  readAt: Date | null;
  createdAt: Date;
}>;
export class PrismaInboxRepository {
  async list(recipientId: string, limit = 50): Promise<readonly InboxItem[]> {
    return (
      await database.inboxNotification.findMany({
        where: { recipientId },
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 50),
      })
    ).map((item) => ({
      ...item,
      variables: item.variables as Record<string, string | number | null>,
    }));
  }
  async markRead(
    id: string,
    recipientId: string,
    now: Date,
  ): Promise<Result<InboxItem, "NOTIFICATION_NOT_FOUND">> {
    const item = await database.inboxNotification.findFirst({
      where: { id, recipientId },
    });
    if (!item) return { ok: false, error: "NOTIFICATION_NOT_FOUND" };
    if (item.readAt === null) {
      await database.inboxNotification.updateMany({
        where: { id, recipientId, readAt: null },
        data: { readAt: now },
      });
    }
    const updated = await database.inboxNotification.findFirstOrThrow({
      where: { id, recipientId },
    });
    return {
      ok: true,
      value: {
        ...updated,
        variables: updated.variables as Record<string, string | number | null>,
      },
    };
  }
}
export const prismaInboxRepository = new PrismaInboxRepository();
