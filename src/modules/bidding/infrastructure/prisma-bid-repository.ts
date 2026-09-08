import { Prisma } from "../../../generated/prisma/client";
import type { Bid as BidRow } from "../../../generated/prisma/client";
import { database } from "../../../infrastructure/db/client";
import type { Result } from "../../shared";
import type { BidSummaryRepository } from "../application/get-bid-summary";
import type { BidSummariesRepository } from "../application/list-bid-summaries";
import type { ListTenderBidsRepository } from "../application/list-tender-bids";
import type { BidPresenceRepository } from "../application/tender-has-active-bids";
import type { ReviseBidRepository } from "../application/revise-bid";
import type {
  SubmitBidCommand,
  SubmitBidRepository,
} from "../application/submit-bid";
import type { WithdrawBidRepository } from "../application/withdraw-bid";
import type { Bid, BidCurrency, RankableBid } from "../domain/bid";

function toBid(row: BidRow): Bid | null {
  // The same never-throw convention the tenders repository uses: a row whose
  // currency this module cannot represent is treated as absent rather than
  // coerced, because coercing would misreport an amount in minor units.
  if (row.currency !== "GEL" && row.currency !== "USD") return null;
  return {
    id: row.id,
    tenderId: row.tenderId,
    providerId: row.providerId,
    amountMinorUnits: row.amountMinorUnits,
    currency: row.currency as BidCurrency,
    status: row.status,
    proposedStartDate: row.proposedStartDate,
    durationDays: row.durationDays,
    includedCosts: row.includedCosts,
    exclusions: row.exclusions,
    conditions: row.conditions,
    qualifyingSubmittedAt: row.qualifyingSubmittedAt,
    withdrawnAt: row.withdrawnAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function termsData(command: SubmitBidCommand) {
  return {
    amountMinorUnits: command.amountMinorUnits,
    proposedStartDate: command.proposedStartDate ?? null,
    durationDays: command.durationDays ?? null,
    includedCosts: command.includedCosts ?? null,
    exclusions: command.exclusions ?? null,
    conditions: command.conditions,
  };
}

export class PrismaBidRepository
  implements
    SubmitBidRepository,
    ReviseBidRepository,
    WithdrawBidRepository,
    BidPresenceRepository,
    BidSummaryRepository,
    BidSummariesRepository,
    ListTenderBidsRepository
{
  async insertBid(
    bid: Readonly<{
      id: string;
      tenderId: string;
      providerId: string;
      amountMinorUnits: number;
      currency: BidCurrency;
      command: SubmitBidCommand;
      qualifyingSubmittedAt: Date;
    }>,
    deadline: Date,
  ): Promise<
    Result<Bid, "BID_ALREADY_EXISTS" | "DEADLINE_PASSED" | "TENDER_NOT_OPEN">
  > {
    // Cheap re-check against the deadline the caller already validated, using
    // the timestamp this write will store, so a request that stalled between
    // the check and the write cannot land a late bid.
    if (bid.qualifyingSubmittedAt.getTime() >= deadline.getTime()) {
      return { ok: false, error: "DEADLINE_PASSED" };
    }
    try {
      return await database.$transaction(async (tx) => {
        // Serialize with cancellation, published edits, and deadline selection.
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "Tender" WHERE "id" = ${bid.tenderId} FOR UPDATE`,
        );
        const tender = await tx.tender.findUnique({
          where: { id: bid.tenderId },
          select: { status: true, deadline: true },
        });
        if (!tender || tender.status !== "PUBLISHED")
          return { ok: false as const, error: "TENDER_NOT_OPEN" as const };
        // Use wall time after acquiring the lock: a request may wait past close.
        if (
          !tender.deadline ||
          tender.deadline <= new Date() ||
          bid.qualifyingSubmittedAt >= tender.deadline
        )
          return { ok: false as const, error: "DEADLINE_PASSED" as const };
        const created = await tx.bid.create({
          data: {
            id: bid.id,
            tenderId: bid.tenderId,
            providerId: bid.providerId,
            currency: bid.currency,
            status: "SUBMITTED",
            qualifyingSubmittedAt: bid.qualifyingSubmittedAt,
            ...termsData(bid.command),
          },
        });
        const mapped = toBid(created);
        if (mapped === null) {
          throw new Error(`Failed to map newly created bid ${created.id}.`);
        }
        return { ok: true as const, value: mapped };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        // The unique (tenderId, providerId) constraint: one active bid per
        // provider per tender, enforced by the database rather than by a
        // read-then-write the next request could interleave with.
        return { ok: false, error: "BID_ALREADY_EXISTS" };
      }
      throw error;
    }
  }

  async reviseOwnBid(
    tenderId: string,
    providerId: string,
    command: SubmitBidCommand,
    qualifyingSubmittedAt: Date,
    deadline: Date,
  ): Promise<
    Result<Bid, "BID_NOT_FOUND" | "BID_NOT_ACTIVE" | "DEADLINE_PASSED">
  > {
    // Cheap re-check against the timestamp this write will store, matching
    // `insertBid`, so a request that stalled cannot land a late revision.
    if (qualifyingSubmittedAt.getTime() >= deadline.getTime()) {
      return { ok: false, error: "DEADLINE_PASSED" };
    }
    // The conditional `updateMany` IS the state transition: ownership, active
    // status, and the tender's own deadline are all part of the single
    // statement, exactly like the tenders module's publish/cancel guards.
    const { count } = await database.bid.updateMany({
      where: {
        tenderId,
        providerId,
        status: "SUBMITTED",
        tender: {
          status: "PUBLISHED",
          deadline: { gt: qualifyingSubmittedAt },
        },
      },
      data: { ...termsData(command), qualifyingSubmittedAt },
    });

    if (count === 0) {
      const existing = await database.bid.findUnique({
        where: { tenderId_providerId: { tenderId, providerId } },
        select: { status: true },
      });
      if (existing === null) return { ok: false, error: "BID_NOT_FOUND" };
      if (existing.status !== "SUBMITTED") {
        return { ok: false, error: "BID_NOT_ACTIVE" };
      }
      // Owned, active, still not updated: the tender closed or its deadline
      // elapsed during the round trip.
      return { ok: false, error: "DEADLINE_PASSED" };
    }

    const updated = await database.bid.findUniqueOrThrow({
      where: { tenderId_providerId: { tenderId, providerId } },
    });
    const mapped = toBid(updated);
    return mapped === null
      ? { ok: false, error: "BID_NOT_FOUND" }
      : { ok: true, value: mapped };
  }

  async withdrawOwnBid(
    tenderId: string,
    providerId: string,
    withdrawnAt: Date,
    deadline: Date,
  ): Promise<
    Result<Bid, "BID_NOT_FOUND" | "BID_NOT_ACTIVE" | "DEADLINE_PASSED">
  > {
    if (withdrawnAt.getTime() >= deadline.getTime()) {
      return { ok: false, error: "DEADLINE_PASSED" };
    }
    const { count } = await database.bid.updateMany({
      where: {
        tenderId,
        providerId,
        status: "SUBMITTED",
        tender: { status: "PUBLISHED", deadline: { gt: withdrawnAt } },
      },
      data: { status: "WITHDRAWN", withdrawnAt },
    });

    if (count === 0) {
      const existing = await database.bid.findUnique({
        where: { tenderId_providerId: { tenderId, providerId } },
        select: { status: true },
      });
      if (existing === null) return { ok: false, error: "BID_NOT_FOUND" };
      if (existing.status !== "SUBMITTED") {
        return { ok: false, error: "BID_NOT_ACTIVE" };
      }
      return { ok: false, error: "DEADLINE_PASSED" };
    }

    const updated = await database.bid.findUniqueOrThrow({
      where: { tenderId_providerId: { tenderId, providerId } },
    });
    const mapped = toBid(updated);
    return mapped === null
      ? { ok: false, error: "BID_NOT_FOUND" }
      : { ok: true, value: mapped };
  }

  async countActiveBids(tenderId: string): Promise<number> {
    return database.bid.count({
      where: { tenderId, status: { not: "WITHDRAWN" } },
    });
  }

  async listBids(tenderId: string): Promise<readonly Bid[]> {
    const rows = await database.bid.findMany({
      where: { tenderId },
      orderBy: [
        { amountMinorUnits: "asc" },
        { qualifyingSubmittedAt: "asc" },
        { id: "asc" },
      ],
    });
    return rows.map(toBid).filter((bid): bid is Bid => bid !== null);
  }

  async listRankableBids(tenderId: string): Promise<readonly RankableBid[]> {
    const rows = await database.bid.findMany({
      where: { tenderId },
      select: {
        id: true,
        amountMinorUnits: true,
        currency: true,
        status: true,
        qualifyingSubmittedAt: true,
      },
      orderBy: [
        { amountMinorUnits: "asc" },
        { qualifyingSubmittedAt: "asc" },
        { id: "asc" },
      ],
    });
    return rows
      .filter((row) => row.currency === "GEL" || row.currency === "USD")
      .map((row) => ({
        id: row.id,
        amountMinorUnits: row.amountMinorUnits,
        currency: row.currency as BidCurrency,
        status: row.status,
        qualifyingSubmittedAt: row.qualifyingSubmittedAt,
      }));
  }

  async listRankableBidsForTenders(
    tenderIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly RankableBid[]>> {
    const grouped = new Map<string, RankableBid[]>();
    if (tenderIds.length === 0) return grouped;

    const rows = await database.bid.findMany({
      where: { tenderId: { in: [...tenderIds] } },
      select: {
        id: true,
        tenderId: true,
        amountMinorUnits: true,
        currency: true,
        status: true,
        qualifyingSubmittedAt: true,
      },
      orderBy: [
        { amountMinorUnits: "asc" },
        { qualifyingSubmittedAt: "asc" },
        { id: "asc" },
      ],
    });

    for (const row of rows) {
      if (row.currency !== "GEL" && row.currency !== "USD") continue;
      const bucket = grouped.get(row.tenderId) ?? [];
      bucket.push({
        id: row.id,
        amountMinorUnits: row.amountMinorUnits,
        currency: row.currency as BidCurrency,
        status: row.status,
        qualifyingSubmittedAt: row.qualifyingSubmittedAt,
      });
      grouped.set(row.tenderId, bucket);
    }

    return grouped;
  }

  async findOwnBid(tenderId: string, providerId: string): Promise<Bid | null> {
    const row = await database.bid.findUnique({
      where: { tenderId_providerId: { tenderId, providerId } },
    });
    return row === null ? null : toBid(row);
  }
}

export const prismaBidRepository = new PrismaBidRepository();
