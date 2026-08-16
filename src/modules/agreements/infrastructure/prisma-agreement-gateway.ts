import { Prisma, type Agreement } from "../../../generated/prisma/client";
import { database } from "../../../infrastructure/db/client";
import { OUTBOX_TOPICS } from "../../notifications/domain/outbox-topic";
import { prismaNotificationPublisher } from "../../notifications/infrastructure/prisma-outbox-gateway";
import type { IdGenerator, Result } from "../../shared";
import {
  confirmationDeadline,
  transitionAgreement,
  type AgreementAction,
  type AgreementRecord,
  type AgreementSnapshot,
} from "../domain/agreement";

export type AgreementView = Readonly<{
  id: string;
  clientId: string;
  providerId: string;
  status: Agreement["status"];
  snapshot: AgreementSnapshot;
  confirmDeadline: Date;
  clientConfirmedAt: Date | null;
  providerConfirmedAt: Date | null;
  clientStartedAt: Date | null;
  providerStartedAt: Date | null;
  clientCompletedAt: Date | null;
  providerCompletedAt: Date | null;
  cancelledAt: Date | null;
  cancelledById: string | null;
  cancellationReasonCode: Agreement["cancellationReasonCode"];
  cancellationExplanation: string | null;
  completedAt: Date | null;
  partyRole: "CLIENT" | "PROVIDER";
  canConfirm: boolean;
  canDecline: boolean;
  canAcknowledgeStart: boolean;
  canConfirmCompletion: boolean;
  canCancel: boolean;
  canReview: boolean;
}>;
export type AgreementRepository = {
  manage(
    id: string,
    action: AgreementAction,
    now: Date,
    ids: IdGenerator,
  ): Promise<
    Result<
      AgreementView,
      | "AGREEMENT_NOT_FOUND"
      | "NOT_PARTICIPANT"
      | "INVALID_STATE"
      | "CONFIRMATION_EXPIRED"
      | "INVALID_EXPLANATION"
    >
  >;
  listDueConfirmationIds(now: Date, limit: number): Promise<readonly string[]>;
  get(
    id: string,
    actorId: string,
  ): Promise<Result<AgreementView, "AGREEMENT_NOT_FOUND" | "NOT_PARTICIPANT">>;
  getForTender(
    tenderId: string,
    actorId: string,
  ): Promise<Result<AgreementView, "AGREEMENT_NOT_FOUND" | "NOT_PARTICIPANT">>;
  list(
    actorId: string,
    role: "CLIENT" | "PROVIDER",
  ): Promise<readonly AgreementView[]>;
};
export interface AgreementGateway {
  createPending(
    transaction: Prisma.TransactionClient,
    agreementId: string,
    snapshot: AgreementSnapshot,
    now: Date,
  ): Promise<string>;
}
const view = (row: Agreement, actorId = row.clientId): AgreementView => ({
  ...row,
  snapshot: row.snapshot as unknown as AgreementSnapshot,
  partyRole: actorId === row.clientId ? "CLIENT" : "PROVIDER",
  canConfirm:
    row.status === "PENDING_CONFIRMATION" &&
    row.confirmDeadline > new Date() &&
    (actorId === row.clientId
      ? row.clientConfirmedAt === null
      : row.providerConfirmedAt === null),
  canDecline:
    row.status === "PENDING_CONFIRMATION" && row.confirmDeadline > new Date(),
  canAcknowledgeStart:
    row.status === "AGREED" &&
    (actorId === row.clientId
      ? row.clientStartedAt === null
      : row.providerStartedAt === null),
  canConfirmCompletion:
    row.status === "IN_PROGRESS" &&
    (actorId === row.clientId
      ? row.clientCompletedAt === null
      : row.providerCompletedAt === null),
  canCancel: row.status === "AGREED" || row.status === "IN_PROGRESS",
  canReview: row.status === "COMPLETED",
});
const record = (row: Agreement): AgreementRecord => ({
  id: row.id,
  clientId: row.clientId,
  providerId: row.providerId,
  status: row.status,
  confirmDeadline: row.confirmDeadline,
  clientConfirmedAt: row.clientConfirmedAt,
  providerConfirmedAt: row.providerConfirmedAt,
  clientStartedAt: row.clientStartedAt,
  providerStartedAt: row.providerStartedAt,
  clientCompletedAt: row.clientCompletedAt,
  providerCompletedAt: row.providerCompletedAt,
  cancelledAt: row.cancelledAt,
  cancelledById: row.cancelledById,
  cancellationReasonCode: row.cancellationReasonCode,
  cancellationExplanation: row.cancellationExplanation,
});
const topics = {
  PARTY_CONFIRMED: OUTBOX_TOPICS.agreementPartyConfirmed,
  AGREEMENT_AGREED: OUTBOX_TOPICS.agreementAgreed,
  AGREEMENT_DECLINED: OUTBOX_TOPICS.agreementDeclined,
  AGREEMENT_EXPIRED: OUTBOX_TOPICS.agreementExpired,
  PARTY_ACKNOWLEDGED_START: OUTBOX_TOPICS.workStartAcknowledged,
  WORK_STARTED: OUTBOX_TOPICS.workStarted,
  PARTY_CONFIRMED_COMPLETION: OUTBOX_TOPICS.completionConfirmed,
  AGREEMENT_COMPLETED: OUTBOX_TOPICS.agreementCompleted,
  AGREEMENT_CANCELLED: OUTBOX_TOPICS.agreementCancelled,
} as const;
const messageKeys = {
  PARTY_CONFIRMED: "notifications.agreementPartyConfirmed",
  AGREEMENT_AGREED: "notifications.agreementAgreed",
  AGREEMENT_DECLINED: "notifications.agreementDeclined",
  AGREEMENT_EXPIRED: "notifications.agreementExpired",
  PARTY_ACKNOWLEDGED_START: "notifications.workStartAcknowledged",
  WORK_STARTED: "notifications.workStarted",
  PARTY_CONFIRMED_COMPLETION: "notifications.completionConfirmed",
  AGREEMENT_COMPLETED: "notifications.agreementCompleted",
  AGREEMENT_CANCELLED: "notifications.agreementCancelled",
} as const;
export class PrismaAgreementGateway
  implements AgreementGateway, AgreementRepository
{
  async createPending(
    transaction: Prisma.TransactionClient,
    agreementId: string,
    snapshot: AgreementSnapshot,
    now: Date,
  ) {
    const created = await transaction.agreement.create({
      data: {
        id: agreementId,
        tenderId: snapshot.tenderId,
        clientId: snapshot.clientId,
        providerId: snapshot.providerId,
        bidId: snapshot.bidId,
        status: "PENDING_CONFIRMATION",
        amountMinorUnits: snapshot.amountMinorUnits,
        currency: snapshot.currency,
        tenderTitle: snapshot.tenderTitle,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        confirmDeadline: confirmationDeadline(now),
      },
      select: { id: true },
    });
    return created.id;
  }
  async listDueConfirmationIds(now: Date, limit: number) {
    return (
      await database.agreement.findMany({
        where: {
          status: "PENDING_CONFIRMATION",
          confirmDeadline: { lte: now },
        },
        orderBy: [{ confirmDeadline: "asc" }, { id: "asc" }],
        take: limit,
        select: { id: true },
      })
    ).map((row) => row.id);
  }
  async get(id: string, actorId: string) {
    const row = await database.agreement.findUnique({ where: { id } });
    if (!row)
      return { ok: false as const, error: "AGREEMENT_NOT_FOUND" as const };
    if (actorId !== row.clientId && actorId !== row.providerId)
      return { ok: false as const, error: "NOT_PARTICIPANT" as const };
    return { ok: true as const, value: view(row, actorId) };
  }
  async getForTender(tenderId: string, actorId: string) {
    const row = await database.agreement.findUnique({ where: { tenderId } });
    if (!row)
      return { ok: false as const, error: "AGREEMENT_NOT_FOUND" as const };
    if (actorId !== row.clientId && actorId !== row.providerId)
      return { ok: false as const, error: "NOT_PARTICIPANT" as const };
    return { ok: true as const, value: view(row, actorId) };
  }
  async list(actorId: string, role: "CLIENT" | "PROVIDER") {
    const rows = await database.agreement.findMany({
      where:
        role === "CLIENT" ? { clientId: actorId } : { providerId: actorId },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((row) => view(row, actorId));
  }
  async manage(
    id: string,
    action: AgreementAction,
    now: Date,
    ids: IdGenerator,
  ): Promise<
    Result<
      AgreementView,
      | "AGREEMENT_NOT_FOUND"
      | "NOT_PARTICIPANT"
      | "INVALID_STATE"
      | "CONFIRMATION_EXPIRED"
      | "INVALID_EXPLANATION"
    >
  > {
    for (let attempt = 0; attempt < 3; attempt += 1)
      try {
        return await database.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT "id" FROM "Agreement" WHERE "id" = ${id} FOR UPDATE`;
            const row = await tx.agreement.findUnique({ where: { id } });
            if (!row) return { ok: false, error: "AGREEMENT_NOT_FOUND" };
            const next = transitionAgreement(record(row), action, now);
            if (!next.ok) {
              return {
                ok: false,
                error: next.error === "NOT_DUE" ? "INVALID_STATE" : next.error,
              };
            }
            if (!next.value.changed)
              return {
                ok: true,
                value: view(row, action.actorId ?? row.clientId),
              };
            const r = next.value.record;
            const updated = await tx.agreement.update({
              where: { id },
              data: {
                status: r.status,
                clientConfirmedAt: r.clientConfirmedAt,
                providerConfirmedAt: r.providerConfirmedAt,
                clientStartedAt: r.clientStartedAt,
                providerStartedAt: r.providerStartedAt,
                clientCompletedAt: r.clientCompletedAt,
                providerCompletedAt: r.providerCompletedAt,
                cancelledAt: r.cancelledAt,
                cancelledById: r.cancelledById,
                cancellationReasonCode: r.cancellationReasonCode,
                cancellationExplanation: r.cancellationExplanation,
                completedAt: r.status === "COMPLETED" ? now : row.completedAt,
              },
            });
            const event = next.value.event;
            await tx.auditEvent.create({
              data: {
                id: ids.next(),
                actorId: action.actorId,
                action:
                  event === "PARTY_CONFIRMED"
                    ? "AGREEMENT_PARTY_CONFIRMED"
                    : event === "PARTY_ACKNOWLEDGED_START"
                      ? "AGREEMENT_START_ACKNOWLEDGED"
                      : event === "WORK_STARTED"
                        ? "AGREEMENT_IN_PROGRESS"
                        : event === "PARTY_CONFIRMED_COMPLETION"
                          ? "AGREEMENT_COMPLETION_CONFIRMED"
                          : event,
                targetType: "Agreement",
                targetId: id,
                correlationId: id,
                metadata: {},
              },
            });
            const recipients =
              event === "PARTY_CONFIRMED" ||
              event === "PARTY_ACKNOWLEDGED_START" ||
              event === "PARTY_CONFIRMED_COMPLETION"
                ? [
                    action.actorId === row.clientId
                      ? row.providerId
                      : row.clientId,
                  ]
                : [row.clientId, row.providerId];
            const topic = topics[event];
            await prismaNotificationPublisher.publish(
              tx,
              recipients.map((recipientId) => ({
                recipientId,
                topic,
                aggregateType: "Agreement",
                aggregateId: id,
                messageKey: messageKeys[event],
                variables: { agreementId: id, tenderTitle: row.tenderTitle },
              })),
              recipients.map(() => ({
                outboxId: ids.next(),
                inboxId: ids.next(),
              })),
              now,
            );
            return {
              ok: true,
              value: view(updated, action.actorId ?? row.clientId),
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== "P2034" ||
          attempt === 2
        )
          throw error;
      }
    throw new Error("unreachable");
  }
}
export const prismaAgreementGateway = new PrismaAgreementGateway();
