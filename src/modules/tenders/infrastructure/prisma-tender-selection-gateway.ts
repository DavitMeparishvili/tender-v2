import { Prisma } from "../../../generated/prisma/client";
import { database } from "../../../infrastructure/db/client";
import type { Result } from "../../shared";
import type { TenderBiddingContext } from "../application/get-tender-bidding-context";

export type TenderClosingOutcome = "WINNER_SELECTED" | "EXPIRED";

export type SelectionTender = TenderBiddingContext &
  Readonly<{ selectionExpiresAt: Date | null }>;

// Choosing a contractor has to mark bids, close the tender, create the
// agreement snapshot, and enqueue audit/outbox rows atomically. Rather than
// letting the `bidding` module write the Tender table directly — which the
// roadmap forbids — `tenders` publishes this gateway, which accepts the
// CALLER's transaction client. The owning module stays the only code that
// writes its own table, and atomicity is preserved.
export interface TenderSelectionGateway {
  // `SELECT ... FOR UPDATE` on the tender row: the serialization point for
  // the client's choice, the deadline sweep, and an agreement decline. The
  // row stays locked for the caller's transaction; the caller decides what
  // the locked status allows.
  lockTender(
    transaction: Prisma.TransactionClient,
    tenderId: string,
  ): Promise<Result<SelectionTender, "TENDER_NOT_FOUND">>;
  listDueTenderIds(now: Date, limit: number): Promise<readonly string[]>;
  awaitSelection(
    transaction: Prisma.TransactionClient,
    tenderId: string,
    selectionExpiresAt: Date,
  ): Promise<void>;
  reopenBidding(
    transaction: Prisma.TransactionClient,
    tenderId: string,
  ): Promise<void>;
  closeAfterSelection(
    transaction: Prisma.TransactionClient,
    tenderId: string,
    outcome: TenderClosingOutcome,
  ): Promise<void>;
}

export class PrismaTenderSelectionGateway implements TenderSelectionGateway {
  async lockTender(
    transaction: Prisma.TransactionClient,
    tenderId: string,
  ): Promise<Result<SelectionTender, "TENDER_NOT_FOUND">> {
    // Raw `FOR UPDATE` because Prisma has no first-class row lock. The same
    // pattern `PrismaProfileRepository.complete` already uses.
    await transaction.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Tender" WHERE "id" = ${tenderId} FOR UPDATE`,
    );
    const row = await transaction.tender.findUnique({
      where: { id: tenderId },
      select: {
        id: true,
        ownerId: true,
        title: true,
        status: true,
        currency: true,
        budgetMinorUnits: true,
        deadline: true,
        selectionExpiresAt: true,
      },
    });
    if (
      row === null ||
      row.deadline === null ||
      row.budgetMinorUnits === null ||
      (row.currency !== "GEL" && row.currency !== "USD") ||
      row.status === "DRAFT" ||
      row.status === "CANCELLED"
    ) {
      return { ok: false, error: "TENDER_NOT_FOUND" };
    }
    return {
      ok: true,
      value: {
        id: row.id,
        ownerId: row.ownerId,
        title: row.title,
        status: row.status,
        currency: row.currency,
        budgetMinorUnits: row.budgetMinorUnits,
        deadline: row.deadline,
        selectionExpiresAt: row.selectionExpiresAt,
      },
    };
  }

  // Due means either: bidding is still PUBLISHED but its deadline has
  // arrived, or the client's selection window has run out.
  async listDueTenderIds(now: Date, limit: number): Promise<readonly string[]> {
    const rows = await database.tender.findMany({
      where: {
        OR: [
          { status: "PUBLISHED", deadline: { lte: now } },
          { status: "AWAITING_SELECTION", selectionExpiresAt: { lte: now } },
        ],
      },
      // Oldest deadline first, so a backlog drains in the order tenders
      // actually became due rather than by insertion order.
      orderBy: [{ deadline: "asc" }, { id: "asc" }],
      take: limit,
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async awaitSelection(
    transaction: Prisma.TransactionClient,
    tenderId: string,
    selectionExpiresAt: Date,
  ): Promise<void> {
    await transaction.tender.update({
      where: { id: tenderId },
      data: { status: "AWAITING_SELECTION", selectionExpiresAt },
    });
  }

  // Back to open bidding: used when the client chose before the deadline and
  // that agreement fell through while the deadline is still ahead.
  async reopenBidding(
    transaction: Prisma.TransactionClient,
    tenderId: string,
  ): Promise<void> {
    await transaction.tender.update({
      where: { id: tenderId },
      data: { status: "PUBLISHED", selectionExpiresAt: null },
    });
  }

  async closeAfterSelection(
    transaction: Prisma.TransactionClient,
    tenderId: string,
    outcome: TenderClosingOutcome,
  ): Promise<void> {
    await transaction.tender.update({
      where: { id: tenderId },
      data: {
        status: outcome === "WINNER_SELECTED" ? "CLOSED" : "EXPIRED",
        selectionExpiresAt: null,
      },
    });
  }
}

export const prismaTenderSelectionGateway = new PrismaTenderSelectionGateway();
