import { Prisma } from "../../../generated/prisma/client";
import { database } from "../../../infrastructure/db/client";
import type { Result } from "../../shared";
import type { TenderBiddingContext } from "../application/get-tender-bidding-context";

export type TenderClosingOutcome = "WINNER_SELECTED" | "EXPIRED_NO_BIDS";

// Winner selection has to mark bids, close the tender, create the agreement
// snapshot, and enqueue audit/outbox rows atomically. Rather than letting the
// `bidding` module write the Tender table directly — which the roadmap
// forbids — `tenders` publishes this gateway, which accepts the CALLER's
// transaction client. The owning module stays the only code that writes its
// own table, and atomicity is preserved.
export interface TenderSelectionGateway {
  // `SELECT ... FOR UPDATE` on the tender row: the serialization point for
  // concurrent selectors. The row stays locked for the caller's transaction.
  lockDueTender(
    transaction: Prisma.TransactionClient,
    tenderId: string,
    now: Date,
  ): Promise<Result<TenderBiddingContext, "TENDER_NOT_FOUND" | "NOT_DUE">>;
  listDueTenderIds(now: Date, limit: number): Promise<readonly string[]>;
  closeAfterSelection(
    transaction: Prisma.TransactionClient,
    tenderId: string,
    outcome: TenderClosingOutcome,
  ): Promise<void>;
}

export class PrismaTenderSelectionGateway implements TenderSelectionGateway {
  async lockDueTender(
    transaction: Prisma.TransactionClient,
    tenderId: string,
    now: Date,
  ): Promise<Result<TenderBiddingContext, "TENDER_NOT_FOUND" | "NOT_DUE">> {
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
      },
    });
    if (
      row === null ||
      row.deadline === null ||
      row.budgetMinorUnits === null ||
      (row.currency !== "GEL" && row.currency !== "USD")
    ) {
      return { ok: false, error: "TENDER_NOT_FOUND" };
    }
    // "Due" means: still open for bidding AND the deadline has arrived.
    // Rejecting execution before the deadline is a program-design invariant
    // (§4.4 step 3), enforced here where the row is already locked rather
    // than in a caller that could race with a deadline extension.
    if (row.status !== "PUBLISHED" || row.deadline.getTime() > now.getTime()) {
      return { ok: false, error: "NOT_DUE" };
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
      },
    };
  }

  async listDueTenderIds(now: Date, limit: number): Promise<readonly string[]> {
    const rows = await database.tender.findMany({
      where: { status: "PUBLISHED", deadline: { lte: now } },
      // Oldest deadline first, so a backlog drains in the order tenders
      // actually became due rather than by insertion order.
      orderBy: { deadline: "asc" },
      take: limit,
      select: { id: true },
    });
    return rows.map((row) => row.id);
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
      },
    });
  }
}

export const prismaTenderSelectionGateway = new PrismaTenderSelectionGateway();
