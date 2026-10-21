import { Prisma } from "../../../generated/prisma/client";
import {
  OUTBOX_TOPICS,
  type NotificationDraft,
} from "../../notifications/domain/outbox-topic";
import { prismaNotificationPublisher } from "../../notifications/infrastructure/prisma-outbox-gateway";
import type { IdGenerator } from "../../shared";
import {
  prismaTenderSelectionGateway,
  type SelectionTender,
} from "../../tenders/infrastructure/prisma-tender-selection-gateway";
import type { BidCurrency, BidTenderTerms, RankableBid } from "../domain/bid";
import { addSelectionWindow, choosableBids } from "../domain/selection";

// The transactional steps of the selection lifecycle that do NOT create an
// agreement: opening the client's selection window, expiring a tender, and
// reacting to the pending agreement being agreed or falling through. They live
// apart from `prisma-selection-repository.ts` because the agreements module
// calls the agreement hooks below from inside its own transaction, and the
// repository itself imports the agreements gateway — keeping these here keeps
// the import graph acyclic.

export type SelectionBidRow = RankableBid &
  Readonly<{
    providerId: string;
    proposedStartDate: Date | null;
    durationDays: number | null;
    includedCosts: string | null;
    exclusions: string | null;
    conditions: string;
  }>;

export function selectionTerms(tender: SelectionTender): BidTenderTerms {
  return { currency: tender.currency, deadline: tender.deadline };
}

// Row-locks every bid on the tender, after the caller already holds the tender
// lock (lock order: Tender, then Bid — the same order every writer uses). A
// revision or withdrawal in flight either commits before this returns, so the
// next read sees it, or waits and then finds the bid settled.
export async function lockSelectionBids(
  transaction: Prisma.TransactionClient,
  tenderId: string,
): Promise<void> {
  await transaction.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Bid" WHERE "tenderId" = ${tenderId} ORDER BY "id" FOR UPDATE`,
  );
}

export async function loadSelectionBids(
  transaction: Prisma.TransactionClient,
  tenderId: string,
): Promise<readonly SelectionBidRow[]> {
  const rows = await transaction.bid.findMany({
    where: { tenderId },
    select: {
      id: true,
      providerId: true,
      amountMinorUnits: true,
      currency: true,
      status: true,
      qualifyingSubmittedAt: true,
      proposedStartDate: true,
      durationDays: true,
      includedCosts: true,
      exclusions: true,
      conditions: true,
    },
    orderBy: [
      { amountMinorUnits: "asc" },
      { qualifyingSubmittedAt: "asc" },
      { id: "asc" },
    ],
  });
  // A currency this module cannot represent is treated as absent, the same
  // never-coerce convention the bid repository uses.
  return rows
    .filter((row) => row.currency === "GEL" || row.currency === "USD")
    .map((row) => ({ ...row, currency: row.currency as BidCurrency }));
}

export async function publishSelectionNotifications(
  transaction: Prisma.TransactionClient,
  drafts: readonly NotificationDraft[],
  now: Date,
  ids: IdGenerator,
): Promise<void> {
  await prismaNotificationPublisher.publish(
    transaction,
    drafts,
    drafts.map(() => ({ outboxId: ids.next(), inboxId: ids.next() })),
    now,
  );
}

export type OpenSelectionReason = "BIDDING_CLOSED" | "AGREEMENT_FELL_THROUGH";

// Puts the tender in front of the client for a choice until `expiresAt`.
export async function openSelection(
  transaction: Prisma.TransactionClient,
  tender: SelectionTender,
  expiresAt: Date,
  reason: OpenSelectionReason,
  choosableCount: number,
  now: Date,
  ids: IdGenerator,
): Promise<void> {
  await prismaTenderSelectionGateway.awaitSelection(
    transaction,
    tender.id,
    expiresAt,
  );
  const messageKey =
    reason === "BIDDING_CLOSED"
      ? "notifications.tenderAwaitingSelection"
      : "notifications.tenderReopenedForSelection";
  await publishSelectionNotifications(
    transaction,
    [
      {
        recipientId: tender.ownerId,
        topic:
          reason === "BIDDING_CLOSED"
            ? OUTBOX_TOPICS.tenderAwaitingSelection
            : OUTBOX_TOPICS.tenderReopenedForSelection,
        aggregateType: "Tender",
        aggregateId: tender.id,
        messageKey,
        variables: {
          tenderId: tender.id,
          tenderTitle: tender.title,
          selectionExpiresAt: expiresAt.toISOString(),
        },
      },
    ],
    now,
    ids,
  );
  await transaction.auditEvent.create({
    data: {
      id: ids.next(),
      // System action: bidding closing or an agreement falling through is
      // not a human choice.
      actorId: null,
      action:
        reason === "BIDDING_CLOSED"
          ? "TENDER_AWAITING_SELECTION"
          : "TENDER_SELECTION_REOPENED",
      targetType: "Tender",
      targetId: tender.id,
      correlationId: tender.id,
      metadata: {
        selectionExpiresAt: expiresAt.toISOString(),
        choosableBids: choosableCount,
      },
    },
  });
}

// Why a tender ends without a contractor. Each reason tells the client the
// true story; the recorded outcome distinguishes "never had an offer" from
// "had offers, none went ahead".
export type ExpiryReason =
  // Bidding closed without a single eligible offer.
  | "NO_BIDS"
  // The client did not choose within the selection window.
  | "WINDOW_ENDED"
  // The chosen contractor agreement fell through and no offer remains.
  | "NO_OFFERS_LEFT";

const EXPIRY_NOTICE = {
  NO_BIDS: {
    outcome: "EXPIRED_NO_BIDS",
    topic: OUTBOX_TOPICS.tenderExpiredNoBids,
    messageKey: "notifications.tenderExpiredNoBids",
  },
  WINDOW_ENDED: {
    outcome: "SELECTION_EXPIRED",
    topic: OUTBOX_TOPICS.tenderSelectionExpired,
    messageKey: "notifications.tenderSelectionExpired",
  },
  NO_OFFERS_LEFT: {
    outcome: "SELECTION_EXPIRED",
    topic: OUTBOX_TOPICS.tenderExpiredNoOffersLeft,
    messageKey: "notifications.tenderExpiredNoOffersLeft",
  },
} as const;

// Ends the tender without a contractor. Every offer still standing becomes
// LOST, and its bidder is told so.
export async function expireSelection(
  transaction: Prisma.TransactionClient,
  tender: SelectionTender,
  reason: ExpiryReason,
  rows: readonly SelectionBidRow[],
  now: Date,
  ids: IdGenerator,
): Promise<string> {
  const notice = EXPIRY_NOTICE[reason];
  const outcome = notice.outcome;
  const standing = rows.filter((row) => row.status === "SUBMITTED");
  await transaction.bid.updateMany({
    where: { tenderId: tender.id, status: "SUBMITTED" },
    data: { status: "LOST" },
  });
  await prismaTenderSelectionGateway.closeAfterSelection(
    transaction,
    tender.id,
    "EXPIRED",
  );
  const selectionId = ids.next();
  await transaction.tenderSelection.create({
    data: {
      id: selectionId,
      tenderId: tender.id,
      outcome,
      winningBidId: null,
      agreementId: null,
      ranAt: now,
    },
  });
  await publishSelectionNotifications(
    transaction,
    [
      {
        recipientId: tender.ownerId,
        topic: notice.topic,
        aggregateType: "Tender",
        aggregateId: tender.id,
        messageKey: notice.messageKey,
        variables: { tenderId: tender.id, tenderTitle: tender.title },
      },
      ...lostDrafts(tender, standing),
    ],
    now,
    ids,
  );
  await transaction.auditEvent.create({
    data: {
      id: ids.next(),
      actorId: null,
      action: "TENDER_SELECTION_EXPIRED",
      targetType: "Tender",
      targetId: tender.id,
      correlationId: selectionId,
      metadata: { outcome, reason, bidsConsidered: rows.length },
    },
  });
  return selectionId;
}

// The client chose before the bidding deadline and that agreement fell
// through: bidding simply resumes until the advertised deadline, with the
// standby offers still in it.
async function reopenBidding(
  transaction: Prisma.TransactionClient,
  tender: SelectionTender,
  standingCount: number,
  now: Date,
  ids: IdGenerator,
): Promise<void> {
  await prismaTenderSelectionGateway.reopenBidding(transaction, tender.id);
  await publishSelectionNotifications(
    transaction,
    [
      {
        recipientId: tender.ownerId,
        topic: OUTBOX_TOPICS.tenderReopenedForBidding,
        aggregateType: "Tender",
        aggregateId: tender.id,
        messageKey: "notifications.tenderReopenedForBidding",
        variables: { tenderId: tender.id, tenderTitle: tender.title },
      },
    ],
    now,
    ids,
  );
  await transaction.auditEvent.create({
    data: {
      id: ids.next(),
      actorId: null,
      action: "TENDER_BIDDING_REOPENED",
      targetType: "Tender",
      targetId: tender.id,
      correlationId: tender.id,
      metadata: {
        deadline: tender.deadline.toISOString(),
        choosableBids: standingCount,
      },
    },
  });
}

function lostDrafts(
  tender: Pick<SelectionTender, "id" | "title">,
  rows: readonly Pick<SelectionBidRow, "id" | "providerId">[],
): NotificationDraft[] {
  return rows.map((row) => ({
    recipientId: row.providerId,
    topic: OUTBOX_TOPICS.bidLost,
    aggregateType: "Tender" as const,
    aggregateId: tender.id,
    messageKey: "notifications.bidLost" as const,
    variables: {
      tenderId: tender.id,
      bidId: row.id,
      tenderTitle: tender.title,
    },
  }));
}

export type SettledAgreementRef = Readonly<{
  tenderId: string;
  bidId: string;
}>;

// Called by the agreements module from inside its own transaction, so the
// agreement transition and its consequence for the tender commit together.
export interface SelectionLifecycleGateway {
  // Both parties confirmed: the offers that were on standby have now lost.
  agreementAgreed(
    transaction: Prisma.TransactionClient,
    agreement: SettledAgreementRef,
    now: Date,
    ids: IdGenerator,
  ): Promise<void>;
  // The pending agreement was declined (by either party) or its confirmation
  // window expired: the chosen offer is out. If the bidding deadline is still
  // ahead, bidding resumes (PUBLISHED); otherwise the client chooses again
  // among the remaining offers for `selectionWindowDays`, or the tender
  // expires if none remain.
  agreementFellThrough(
    transaction: Prisma.TransactionClient,
    agreement: SettledAgreementRef,
    now: Date,
    ids: IdGenerator,
    selectionWindowDays: number,
  ): Promise<void>;
}

export class PrismaSelectionLifecycle implements SelectionLifecycleGateway {
  async agreementAgreed(
    transaction: Prisma.TransactionClient,
    agreement: SettledAgreementRef,
    now: Date,
    ids: IdGenerator,
  ): Promise<void> {
    const locked = await prismaTenderSelectionGateway.lockTender(
      transaction,
      agreement.tenderId,
    );
    if (!locked.ok) return;
    const standing = (
      await loadSelectionBids(transaction, agreement.tenderId)
    ).filter((row) => row.status === "SUBMITTED");
    if (standing.length === 0) return;
    await transaction.bid.updateMany({
      where: { tenderId: agreement.tenderId, status: "SUBMITTED" },
      data: { status: "LOST" },
    });
    await publishSelectionNotifications(
      transaction,
      lostDrafts(locked.value, standing),
      now,
      ids,
    );
  }

  async agreementFellThrough(
    transaction: Prisma.TransactionClient,
    agreement: SettledAgreementRef,
    now: Date,
    ids: IdGenerator,
    selectionWindowDays: number,
  ): Promise<void> {
    const locked = await prismaTenderSelectionGateway.lockTender(
      transaction,
      agreement.tenderId,
    );
    // Only a tender closed on THIS offer reopens. Anything else (a legacy
    // row, a tender already moved on) is left exactly as it is.
    if (!locked.ok || locked.value.status !== "CLOSED") return;
    const { count } = await transaction.bid.updateMany({
      where: { id: agreement.bidId, status: "WINNER" },
      data: { status: "LOST" },
    });
    if (count === 0) return;

    const tender = locked.value;
    const rows = await loadSelectionBids(transaction, tender.id);
    const remaining = choosableBids(rows, selectionTerms(tender));
    if (tender.deadline.getTime() > now.getTime()) {
      await reopenBidding(transaction, tender, remaining.length, now, ids);
      return;
    }
    if (remaining.length === 0) {
      await expireSelection(
        transaction,
        tender,
        "NO_OFFERS_LEFT",
        rows,
        now,
        ids,
      );
      return;
    }
    await openSelection(
      transaction,
      tender,
      addSelectionWindow(now, selectionWindowDays),
      "AGREEMENT_FELL_THROUGH",
      remaining.length,
      now,
      ids,
    );
  }
}

export const prismaSelectionLifecycle = new PrismaSelectionLifecycle();
