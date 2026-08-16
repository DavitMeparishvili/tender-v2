import { Prisma } from "../../../generated/prisma/client";
import { database } from "../../../infrastructure/db/client";
import { prismaAgreementGateway } from "../../agreements/infrastructure/prisma-agreement-gateway";
import type { AgreementSnapshot } from "../../agreements/domain/agreement";
import {
  OUTBOX_TOPICS,
  type NotificationDraft,
} from "../../notifications/domain/outbox-topic";
import { prismaNotificationPublisher } from "../../notifications/infrastructure/prisma-outbox-gateway";
import type { IdGenerator, Result } from "../../shared";
import { prismaTenderSelectionGateway } from "../../tenders/infrastructure/prisma-tender-selection-gateway";
import type {
  SelectionError,
  SelectionRepository,
  SelectionResult,
} from "../application/run-deadline-selection";
import type { BidCurrency, RankableBid } from "../domain/bid";
import { selectWinningBid } from "../domain/ranking";

function toRankable(row: {
  id: string;
  amountMinorUnits: number;
  currency: string;
  status: RankableBid["status"];
  qualifyingSubmittedAt: Date;
}): RankableBid | null {
  if (row.currency !== "GEL" && row.currency !== "USD") return null;
  return {
    id: row.id,
    amountMinorUnits: row.amountMinorUnits,
    currency: row.currency as BidCurrency,
    status: row.status,
    qualifyingSubmittedAt: row.qualifyingSubmittedAt,
  };
}

export class PrismaSelectionRepository implements SelectionRepository {
  async listDueTenderIds(now: Date, limit: number): Promise<readonly string[]> {
    return prismaTenderSelectionGateway.listDueTenderIds(now, limit);
  }

  async runSelection(
    tenderId: string,
    now: Date,
    ids: IdGenerator,
  ): Promise<Result<SelectionResult, SelectionError>> {
    try {
      return await database.$transaction(async (transaction) => {
        // 1. Return the existing result if selection already ran. Read first
        //    so a repeat call is cheap and takes no lock at all.
        const settled = await transaction.tenderSelection.findUnique({
          where: { tenderId },
        });
        if (settled !== null) {
          return {
            ok: true,
            value: {
              tenderId,
              outcome: settled.outcome,
              winningBidId: settled.winningBidId,
              agreementId: settled.agreementId,
              alreadyRan: true,
            },
          } as const;
        }

        // 2. Lock the tender. Concurrent selectors serialize here; the loser
        //    resumes after the winner commits and sees a CLOSED/EXPIRED
        //    tender, i.e. NOT_DUE.
        const locked = await prismaTenderSelectionGateway.lockDueTender(
          transaction,
          tenderId,
          now,
        );
        if (!locked.ok) {
          // The winner may have committed between step 1 and the lock, so
          // re-read before reporting a failure: an already-run selection is a
          // success, not an error.
          const raced = await transaction.tenderSelection.findUnique({
            where: { tenderId },
          });
          if (raced !== null) {
            return {
              ok: true,
              value: {
                tenderId,
                outcome: raced.outcome,
                winningBidId: raced.winningBidId,
                agreementId: raced.agreementId,
                alreadyRan: true,
              },
            } as const;
          }
          return { ok: false, error: locked.error } as const;
        }

        const tender = locked.value;
        const terms = {
          currency: tender.currency,
          deadline: tender.deadline,
        };

        // 3. Load every bid and rank the eligible ones in the domain, not in
        //    SQL: the ordering rule is tested there and must not exist twice.
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
        });
        const rankable = rows
          .map(toRankable)
          .filter((bid): bid is RankableBid => bid !== null);
        const winner = selectWinningBid(rankable, terms);

        const selectionId = ids.next();
        const auditId = ids.next();

        if (winner === null) {
          // 4a. No eligible bid: the tender expires. No agreement is created
          //     and no bid is promoted — the client may republish.
          await prismaTenderSelectionGateway.closeAfterSelection(
            transaction,
            tenderId,
            "EXPIRED_NO_BIDS",
          );
          await transaction.tenderSelection.create({
            data: {
              id: selectionId,
              tenderId,
              outcome: "EXPIRED_NO_BIDS",
              winningBidId: null,
              agreementId: null,
              ranAt: now,
            },
          });
          const drafts: NotificationDraft[] = [
            {
              recipientId: tender.ownerId,
              topic: OUTBOX_TOPICS.tenderExpiredNoBids,
              aggregateType: "Tender",
              aggregateId: tenderId,
              messageKey: "notifications.tenderExpiredNoBids",
              variables: { tenderId, tenderTitle: tender.title },
            },
          ];
          await prismaNotificationPublisher.publish(
            transaction,
            drafts,
            drafts.map(() => ({ outboxId: ids.next(), inboxId: ids.next() })),
            now,
          );
          await transaction.auditEvent.create({
            data: {
              id: auditId,
              // System action: no human selects a winner, so there is no
              // actor to record.
              actorId: null,
              action: "TENDER_SELECTION_EXPIRED",
              targetType: "Tender",
              targetId: tenderId,
              correlationId: selectionId,
              metadata: { bidsConsidered: rows.length },
            },
          });
          return {
            ok: true,
            value: {
              tenderId,
              outcome: "EXPIRED_NO_BIDS" as const,
              winningBidId: null,
              agreementId: null,
              alreadyRan: false,
            },
          } as const;
        }

        // 4b. Exactly one WINNER; every other still-submitted bid becomes
        //     LOST. Withdrawn bids keep their own terminal status.
        const winningRow = rows.find((row) => row.id === winner.id)!;
        await transaction.bid.update({
          where: { id: winner.id },
          data: { status: "WINNER" },
        });
        await transaction.bid.updateMany({
          where: { tenderId, status: "SUBMITTED", id: { not: winner.id } },
          data: { status: "LOST" },
        });

        const agreementId = ids.next();
        const snapshot: AgreementSnapshot = {
          tenderId,
          tenderTitle: tender.title,
          clientId: tender.ownerId,
          providerId: winningRow.providerId,
          bidId: winner.id,
          amountMinorUnits: winner.amountMinorUnits,
          currency: winner.currency,
          proposedStartDate:
            winningRow.proposedStartDate?.toISOString() ?? null,
          durationDays: winningRow.durationDays,
          includedCosts: winningRow.includedCosts,
          exclusions: winningRow.exclusions,
          conditions: winningRow.conditions,
        };
        await prismaAgreementGateway.createPending(
          transaction,
          agreementId,
          snapshot,
          now,
        );
        await prismaTenderSelectionGateway.closeAfterSelection(
          transaction,
          tenderId,
          "WINNER_SELECTED",
        );
        await transaction.tenderSelection.create({
          data: {
            id: selectionId,
            tenderId,
            outcome: "WINNER_SELECTED",
            winningBidId: winner.id,
            agreementId,
            ranAt: now,
          },
        });

        const drafts: NotificationDraft[] = [
          {
            recipientId: tender.ownerId,
            topic: OUTBOX_TOPICS.tenderWinnerSelected,
            aggregateType: "Tender",
            aggregateId: tenderId,
            messageKey: "notifications.tenderWinnerSelected",
            variables: { tenderId, agreementId, tenderTitle: tender.title },
          },
          {
            recipientId: winningRow.providerId,
            topic: OUTBOX_TOPICS.bidWon,
            aggregateType: "Tender",
            aggregateId: tenderId,
            messageKey: "notifications.bidWon",
            variables: {
              tenderId,
              bidId: winner.id,
              agreementId,
              tenderTitle: tender.title,
            },
          },
          ...rows
            .filter((row) => row.id !== winner.id && row.status === "SUBMITTED")
            .map((row) => ({
              recipientId: row.providerId,
              topic: OUTBOX_TOPICS.bidLost,
              aggregateType: "Tender" as const,
              aggregateId: tenderId,
              messageKey: "notifications.bidLost" as const,
              variables: {
                tenderId,
                bidId: row.id,
                tenderTitle: tender.title,
              },
            })),
        ];
        await prismaNotificationPublisher.publish(
          transaction,
          drafts,
          drafts.map(() => ({ outboxId: ids.next(), inboxId: ids.next() })),
          now,
        );
        await transaction.auditEvent.create({
          data: {
            id: auditId,
            actorId: null,
            action: "TENDER_WINNER_SELECTED",
            targetType: "Tender",
            targetId: tenderId,
            correlationId: selectionId,
            metadata: {
              winningBidId: winner.id,
              amountMinorUnits: winner.amountMinorUnits,
              currency: winner.currency,
              bidsConsidered: rows.length,
            },
          },
        });

        return {
          ok: true,
          value: {
            tenderId,
            outcome: "WINNER_SELECTED" as const,
            winningBidId: winner.id,
            agreementId,
            alreadyRan: false,
          },
        } as const;
      });
    } catch (error) {
      // `TenderSelection.tenderId` is UNIQUE: if two transactions somehow both
      // reach the insert, the database refuses the second. That is a success
      // for the caller — the selection exists — so the committed row is
      // returned rather than the constraint error.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const settled = await database.tenderSelection.findUniqueOrThrow({
          where: { tenderId },
        });
        return {
          ok: true,
          value: {
            tenderId,
            outcome: settled.outcome,
            winningBidId: settled.winningBidId,
            agreementId: settled.agreementId,
            alreadyRan: true,
          },
        };
      }
      throw error;
    }
  }
}

export const prismaSelectionRepository = new PrismaSelectionRepository();
