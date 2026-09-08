import { database } from "../../../infrastructure/db/client";
import { Prisma } from "../../../generated/prisma/client";
import type {
  PublishedTenderEdit,
  PublishedEditError,
} from "../application/edit-published-tender";
import type { TenderActor } from "../application/create-tender-draft";
import type { Result } from "../../shared";

export async function savePublishedTenderEdit(
  id: string,
  data: PublishedTenderEdit,
  actor: TenderActor,
): Promise<Result<null, PublishedEditError>> {
  return database.$transaction(async (tx) => {
    // Shares the selection serialization point. Also conflicts with the FK
    // key-share lock used when inserting a bid, so existing bids cannot race
    // the check below. Commercial terms and exact location are immutable here.
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Tender" WHERE "id" = ${id} FOR UPDATE`,
    );
    const tender = await tx.tender.findUnique({
      where: { id },
      select: {
        ownerId: true,
        status: true,
        deadline: true,
        _count: { select: { bids: true } },
      },
    });
    if (!tender) return { ok: false, error: "TENDER_NOT_FOUND" };
    if (tender.ownerId !== actor.id) return { ok: false, error: "NOT_OWNER" };
    if (
      tender.status !== "PUBLISHED" ||
      !tender.deadline ||
      tender.deadline <= new Date() ||
      tender._count.bids > 0
    )
      return { ok: false, error: "EDIT_NOT_ALLOWED" };
    await tx.tender.update({
      where: { id },
      data: { ...data, shortDescription: data.fullDescription.slice(0, 240) },
    });
    return { ok: true, value: null };
  });
}
