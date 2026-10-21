import type { Prisma } from "../../../generated/prisma/client";
import { database } from "../../../infrastructure/db/client";
import { prismaAgreementGateway } from "../../agreements/infrastructure/prisma-agreement-gateway";
import type { AgreementSnapshot } from "../../agreements/domain/agreement";
import { OUTBOX_TOPICS } from "../../notifications/domain/outbox-topic";
import type { IdGenerator, Result } from "../../shared";
import {
  prismaTenderSelectionGateway,
  type SelectionTender,
} from "../../tenders/infrastructure/prisma-tender-selection-gateway";
import type {
  ChooseWinningBidCommand,
  ChooseWinningBidError,
  ChooseWinningBidRepository,
  ChooseWinningBidResult,
} from "../application/choose-winning-bid";
import type {
  SelectionError,
  SelectionRepository,
  SelectionResult,
} from "../application/run-deadline-selection";
import {
  choosableBids,
  isChoosableBid,
  isSelectionOpen,
  selectionWindowFromSweep,
} from "../domain/selection";
import {
  expireSelection,
  loadSelectionBids,
  lockSelectionBids,
  openSelection,
  publishSelectionNotifications,
  selectionTerms,
  type SelectionBidRow,
} from "./prisma-selection-lifecycle";

// The single place an offer becomes the WINNER: the chosen bid is promoted,
// the pending agreement snapshot is created, the tender closes, and the
// client and the chosen contractor are notified — all in the caller's
// transaction, which already holds the tender row lock. The other offers stay
// SUBMITTED on standby: if this agreement falls through, the client chooses
// again among them (see `PrismaSelectionLifecycle`).
async function settleWinner(
  transaction: Prisma.TransactionClient,
  tender: SelectionTender,
  winner: SelectionBidRow,
  bidsConsidered: number,
  actorId: string,
  now: Date,
  ids: IdGenerator,
): Promise<{ agreementId: string } | null> {
  // Guarded on the exact terms that were read, on top of the tender and bid
  // row locks: a withdrawal or a revision that slipped in can never be
  // promoted into a winner whose agreement records different terms. A miss
  // is the first write in the transaction, so returning leaves nothing behind.
  const { count } = await transaction.bid.updateMany({
    where: {
      id: winner.id,
      tenderId: tender.id,
      status: "SUBMITTED",
      amountMinorUnits: winner.amountMinorUnits,
      qualifyingSubmittedAt: winner.qualifyingSubmittedAt,
    },
    data: { status: "WINNER" },
  });
  if (count !== 1) return null;

  const agreementId = ids.next();
  const snapshot: AgreementSnapshot = {
    tenderId: tender.id,
    tenderTitle: tender.title,
    clientId: tender.ownerId,
    providerId: winner.providerId,
    bidId: winner.id,
    amountMinorUnits: winner.amountMinorUnits,
    currency: winner.currency,
    proposedStartDate: winner.proposedStartDate?.toISOString() ?? null,
    durationDays: winner.durationDays,
    includedCosts: winner.includedCosts,
    exclusions: winner.exclusions,
    conditions: winner.conditions,
  };
  await prismaAgreementGateway.createPending(
    transaction,
    agreementId,
    snapshot,
    now,
  );
  await prismaTenderSelectionGateway.closeAfterSelection(
    transaction,
    tender.id,
    "WINNER_SELECTED",
  );
  const selectionId = ids.next();
  await transaction.tenderSelection.create({
    data: {
      id: selectionId,
      tenderId: tender.id,
      outcome: "WINNER_SELECTED",
      winningBidId: winner.id,
      agreementId,
      ranAt: now,
    },
  });
  await publishSelectionNotifications(
    transaction,
    [
      {
        recipientId: tender.ownerId,
        topic: OUTBOX_TOPICS.tenderWinnerSelected,
        aggregateType: "Tender",
        aggregateId: tender.id,
        messageKey: "notifications.tenderWinnerSelected",
        variables: {
          tenderId: tender.id,
          agreementId,
          tenderTitle: tender.title,
        },
      },
      {
        recipientId: winner.providerId,
        topic: OUTBOX_TOPICS.bidWon,
        aggregateType: "Tender",
        aggregateId: tender.id,
        messageKey: "notifications.bidWon",
        variables: {
          tenderId: tender.id,
          bidId: winner.id,
          agreementId,
          tenderTitle: tender.title,
        },
      },
    ],
    now,
    ids,
  );
  await transaction.auditEvent.create({
    data: {
      id: ids.next(),
      // The client's own decision, so the client is the actor.
      actorId,
      action: "TENDER_WINNER_SELECTED",
      targetType: "Tender",
      targetId: tender.id,
      correlationId: selectionId,
      metadata: {
        winningBidId: winner.id,
        amountMinorUnits: winner.amountMinorUnits,
        currency: winner.currency,
        bidsConsidered,
      },
    },
  });
  return { agreementId };
}

async function latestSelection(
  transaction: Prisma.TransactionClient,
  tenderId: string,
) {
  return transaction.tenderSelection.findFirst({
    where: { tenderId },
    orderBy: [{ ranAt: "desc" }, { createdAt: "desc" }],
  });
}

function settledResult(
  tenderId: string,
  outcome: SelectionResult["outcome"],
  overrides: Partial<SelectionResult> = {},
): SelectionResult {
  return {
    tenderId,
    outcome,
    winningBidId: null,
    agreementId: null,
    selectionExpiresAt: null,
    alreadyRan: false,
    ...overrides,
  };
}

export class PrismaSelectionRepository
  implements SelectionRepository, ChooseWinningBidRepository
{
  async listDueTenderIds(now: Date, limit: number): Promise<readonly string[]> {
    return prismaTenderSelectionGateway.listDueTenderIds(now, limit);
  }

  // One step of the deadline sweep for one tender. Never chooses a winner.
  async runSelection(
    tenderId: string,
    now: Date,
    ids: IdGenerator,
    selectionWindowDays: number,
  ): Promise<Result<SelectionResult, SelectionError>> {
    return database.$transaction(async (transaction) => {
      // Lock the tender. Concurrent sweeps, the client's choice, and an
      // agreement decline all serialize here; the loser resumes after the
      // winner commits and sees the new status.
      const locked = await prismaTenderSelectionGateway.lockTender(
        transaction,
        tenderId,
      );
      if (!locked.ok) return { ok: false, error: locked.error } as const;
      const tender = locked.value;

      if (tender.status === "PUBLISHED") {
        // Rejecting execution before the deadline is a program-design
        // invariant, enforced here where the row is already locked rather
        // than in a caller that could race with a deadline extension.
        if (tender.deadline.getTime() > now.getTime()) {
          return { ok: false, error: "NOT_DUE" } as const;
        }
        const rows = await loadSelectionBids(transaction, tenderId);
        const choosable = choosableBids(rows, selectionTerms(tender));
        if (choosable.length === 0) {
          // Nothing to choose from: the tender expires and the client may
          // republish.
          await expireSelection(transaction, tender, "NO_BIDS", rows, now, ids);
          return {
            ok: true,
            value: settledResult(tenderId, "EXPIRED_NO_BIDS"),
          } as const;
        }
        // Normally deadline + N. A sweep arriving later than that (a tender
        // left unswept, e.g. across the deploy) still gives the client a full
        // window from now rather than expiring the tender on the spot.
        const expiresAt = selectionWindowFromSweep(
          tender.deadline,
          now,
          selectionWindowDays,
        );
        await openSelection(
          transaction,
          tender,
          expiresAt,
          "BIDDING_CLOSED",
          choosable.length,
          now,
          ids,
        );
        return {
          ok: true,
          value: settledResult(tenderId, "AWAITING_SELECTION", {
            selectionExpiresAt: expiresAt,
          }),
        } as const;
      }

      if (tender.status === "AWAITING_SELECTION") {
        if (isSelectionOpen(tender, now)) {
          return {
            ok: true,
            value: settledResult(tenderId, "AWAITING_SELECTION", {
              selectionExpiresAt: tender.selectionExpiresAt,
              alreadyRan: true,
            }),
          } as const;
        }
        const rows = await loadSelectionBids(transaction, tenderId);
        await expireSelection(
          transaction,
          tender,
          "WINDOW_ENDED",
          rows,
          now,
          ids,
        );
        return {
          ok: true,
          value: settledResult(tenderId, "SELECTION_EXPIRED"),
        } as const;
      }

      // CLOSED or EXPIRED: report the last recorded result, with no new side
      // effects, so a repeated call is answered identically.
      const settled = await latestSelection(transaction, tenderId);
      if (settled === null) return { ok: false, error: "NOT_DUE" } as const;
      return {
        ok: true,
        value: settledResult(tenderId, settled.outcome, {
          winningBidId: settled.winningBidId,
          agreementId: settled.agreementId,
          alreadyRan: true,
        }),
      } as const;
    });
  }

  async chooseWinner(
    command: ChooseWinningBidCommand,
    ids: IdGenerator,
  ): Promise<Result<ChooseWinningBidResult, ChooseWinningBidError>> {
    const { tenderId, bidId, actorId, now } = command;
    return database.$transaction(async (transaction) => {
      const locked = await prismaTenderSelectionGateway.lockTender(
        transaction,
        tenderId,
      );
      if (!locked.ok) return { ok: false, error: "TENDER_NOT_FOUND" } as const;
      const tender = locked.value;
      if (tender.ownerId !== actorId) {
        return { ok: false, error: "NOT_OWNER" } as const;
      }

      if (tender.status === "CLOSED") {
        // A double submit of the same choice is answered with the original
        // result; a different offer cannot replace the chosen one.
        const settled = await latestSelection(transaction, tenderId);
        if (
          settled?.outcome === "WINNER_SELECTED" &&
          settled.winningBidId === bidId &&
          settled.agreementId !== null
        ) {
          return {
            ok: true,
            value: {
              tenderId,
              winningBidId: bidId,
              agreementId: settled.agreementId,
              alreadyChosen: true,
            },
          } as const;
        }
        return { ok: false, error: "TENDER_NOT_SELECTABLE" } as const;
      }
      if (!isSelectionOpen(tender, now)) {
        return { ok: false, error: "TENDER_NOT_SELECTABLE" } as const;
      }

      // Tender first (above), then its bids: the same lock order as the
      // agreement hooks, so a revision or withdrawal in flight settles before
      // the terms are read.
      await lockSelectionBids(transaction, tenderId);
      const rows = await loadSelectionBids(transaction, tenderId);
      const chosen = rows.find((row) => row.id === bidId);
      if (chosen === undefined) {
        return { ok: false, error: "BID_NOT_FOUND" } as const;
      }
      if (!isChoosableBid(chosen, selectionTerms(tender))) {
        return { ok: false, error: "BID_NOT_SELECTABLE" } as const;
      }

      const settled = await settleWinner(
        transaction,
        tender,
        chosen,
        rows.length,
        actorId,
        now,
        ids,
      );
      if (settled === null) {
        return { ok: false, error: "BID_NOT_SELECTABLE" } as const;
      }
      const { agreementId } = settled;
      return {
        ok: true,
        value: {
          tenderId,
          winningBidId: bidId,
          agreementId,
          alreadyChosen: false,
        },
      } as const;
    });
  }
}

export const prismaSelectionRepository = new PrismaSelectionRepository();
