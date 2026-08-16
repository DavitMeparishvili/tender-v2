import type { Result } from "@/src/modules/shared/domain/result";

export type AgreementStatus =
  "PENDING_CONFIRMATION" | "AGREED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type CancellationReasonCode =
  | "PARTY_DECLINED"
  | "SCHEDULE_CHANGED"
  | "SCOPE_CANNOT_PROCEED"
  | "OTHER"
  | "CONFIRMATION_EXPIRED";

export const AGREEMENT_CONFIRMATION_WINDOW_MS = 48 * 60 * 60 * 1000;

export type AgreementSnapshot = Readonly<{
  tenderId: string;
  tenderTitle: string;
  clientId: string;
  providerId: string;
  bidId: string;
  amountMinorUnits: number;
  currency: "GEL" | "USD";
  proposedStartDate: string | null;
  durationDays: number | null;
  includedCosts: string | null;
  exclusions: string | null;
  conditions: string;
}>;

export type AgreementRecord = Readonly<{
  id: string;
  clientId: string;
  providerId: string;
  status: AgreementStatus;
  confirmDeadline: Date;
  clientConfirmedAt: Date | null;
  providerConfirmedAt: Date | null;
  clientStartedAt: Date | null;
  providerStartedAt: Date | null;
  clientCompletedAt: Date | null;
  providerCompletedAt: Date | null;
  cancelledAt: Date | null;
  cancelledById: string | null;
  cancellationReasonCode: CancellationReasonCode | null;
  cancellationExplanation: string | null;
}>;

export type AgreementAction =
  | Readonly<{ type: "CONFIRM"; actorId: string }>
  | Readonly<{ type: "DECLINE"; actorId: string; explanation: string }>
  | Readonly<{ type: "ACKNOWLEDGE_START"; actorId: string }>
  | Readonly<{ type: "CONFIRM_COMPLETION"; actorId: string }>
  | Readonly<{
      type: "CANCEL";
      actorId: string;
      reasonCode: Exclude<
        CancellationReasonCode,
        "PARTY_DECLINED" | "CONFIRMATION_EXPIRED"
      >;
      explanation: string;
    }>
  | Readonly<{ type: "EXPIRE"; actorId: null }>;

export type AgreementTransitionError =
  | "NOT_PARTICIPANT"
  | "INVALID_STATE"
  | "CONFIRMATION_EXPIRED"
  | "NOT_DUE"
  | "INVALID_EXPLANATION";

export type AgreementTransition = Readonly<{
  record: AgreementRecord;
  changed: boolean;
  event:
    | "PARTY_CONFIRMED"
    | "AGREEMENT_AGREED"
    | "AGREEMENT_DECLINED"
    | "AGREEMENT_EXPIRED"
    | "PARTY_ACKNOWLEDGED_START"
    | "WORK_STARTED"
    | "PARTY_CONFIRMED_COMPLETION"
    | "AGREEMENT_COMPLETED"
    | "AGREEMENT_CANCELLED";
}>;

export function confirmationDeadline(now: Date): Date {
  return new Date(now.getTime() + AGREEMENT_CONFIRMATION_WINDOW_MS);
}

function isParticipant(record: AgreementRecord, actorId: string): boolean {
  return actorId === record.clientId || actorId === record.providerId;
}

function normalizeExplanation(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

function cancellationExplanation(value: string): string | null {
  const normalized = normalizeExplanation(value);
  const length = Array.from(normalized).length;
  return length >= 10 && length <= 1_000 ? normalized : null;
}

function success(
  record: AgreementRecord,
  changed: boolean,
  event: AgreementTransition["event"],
): Result<AgreementTransition, AgreementTransitionError> {
  return { ok: true, value: { record, changed, event } };
}

function cancel(
  record: AgreementRecord,
  actorId: string | null,
  reasonCode: CancellationReasonCode,
  explanation: string | null,
  now: Date,
  event: "AGREEMENT_DECLINED" | "AGREEMENT_EXPIRED" | "AGREEMENT_CANCELLED",
): Result<AgreementTransition, AgreementTransitionError> {
  return success(
    {
      ...record,
      status: "CANCELLED",
      cancelledAt: now,
      cancelledById: actorId,
      cancellationReasonCode: reasonCode,
      cancellationExplanation: explanation,
    },
    true,
    event,
  );
}

export function transitionAgreement(
  record: AgreementRecord,
  action: AgreementAction,
  now: Date,
): Result<AgreementTransition, AgreementTransitionError> {
  if (action.type !== "EXPIRE" && !isParticipant(record, action.actorId)) {
    return { ok: false, error: "NOT_PARTICIPANT" };
  }

  if (record.status === "COMPLETED" || record.status === "CANCELLED") {
    return { ok: false, error: "INVALID_STATE" };
  }

  if (action.type === "EXPIRE") {
    if (record.status !== "PENDING_CONFIRMATION") {
      return { ok: false, error: "INVALID_STATE" };
    }
    if (now < record.confirmDeadline) return { ok: false, error: "NOT_DUE" };
    return cancel(
      record,
      null,
      "CONFIRMATION_EXPIRED",
      null,
      now,
      "AGREEMENT_EXPIRED",
    );
  }

  if (action.type === "CONFIRM" || action.type === "DECLINE") {
    if (record.status !== "PENDING_CONFIRMATION") {
      return { ok: false, error: "INVALID_STATE" };
    }
    if (now >= record.confirmDeadline) {
      return { ok: false, error: "CONFIRMATION_EXPIRED" };
    }
  }

  if (action.type === "CONFIRM") {
    const alreadyConfirmed =
      action.actorId === record.clientId
        ? record.clientConfirmedAt !== null
        : record.providerConfirmedAt !== null;
    if (alreadyConfirmed) return success(record, false, "PARTY_CONFIRMED");
    const next = {
      ...record,
      clientConfirmedAt:
        action.actorId === record.clientId ? now : record.clientConfirmedAt,
      providerConfirmedAt:
        action.actorId === record.providerId ? now : record.providerConfirmedAt,
    };
    if (next.clientConfirmedAt !== null && next.providerConfirmedAt !== null) {
      return success({ ...next, status: "AGREED" }, true, "AGREEMENT_AGREED");
    }
    return success(next, true, "PARTY_CONFIRMED");
  }

  if (action.type === "DECLINE") {
    const explanation = cancellationExplanation(action.explanation);
    if (explanation === null)
      return { ok: false, error: "INVALID_EXPLANATION" };
    return cancel(
      record,
      action.actorId,
      "PARTY_DECLINED",
      explanation,
      now,
      "AGREEMENT_DECLINED",
    );
  }

  if (action.type === "CANCEL") {
    if (record.status !== "AGREED" && record.status !== "IN_PROGRESS") {
      return { ok: false, error: "INVALID_STATE" };
    }
    const explanation = cancellationExplanation(action.explanation);
    if (explanation === null)
      return { ok: false, error: "INVALID_EXPLANATION" };
    return cancel(
      record,
      action.actorId,
      action.reasonCode,
      explanation,
      now,
      "AGREEMENT_CANCELLED",
    );
  }

  if (action.type === "ACKNOWLEDGE_START") {
    if (record.status !== "AGREED" && record.status !== "IN_PROGRESS") {
      return { ok: false, error: "INVALID_STATE" };
    }
    const alreadyAcknowledged =
      action.actorId === record.clientId
        ? record.clientStartedAt !== null
        : record.providerStartedAt !== null;
    if (alreadyAcknowledged)
      return success(record, false, "PARTY_ACKNOWLEDGED_START");
    const next = {
      ...record,
      clientStartedAt:
        action.actorId === record.clientId ? now : record.clientStartedAt,
      providerStartedAt:
        action.actorId === record.providerId ? now : record.providerStartedAt,
    };
    if (next.clientStartedAt !== null && next.providerStartedAt !== null) {
      return success({ ...next, status: "IN_PROGRESS" }, true, "WORK_STARTED");
    }
    return success(next, true, "PARTY_ACKNOWLEDGED_START");
  }

  if (record.status !== "IN_PROGRESS")
    return { ok: false, error: "INVALID_STATE" };
  const alreadyConfirmed =
    action.actorId === record.clientId
      ? record.clientCompletedAt !== null
      : record.providerCompletedAt !== null;
  if (alreadyConfirmed)
    return success(record, false, "PARTY_CONFIRMED_COMPLETION");
  const next = {
    ...record,
    clientCompletedAt:
      action.actorId === record.clientId ? now : record.clientCompletedAt,
    providerCompletedAt:
      action.actorId === record.providerId ? now : record.providerCompletedAt,
  };
  if (next.clientCompletedAt !== null && next.providerCompletedAt !== null) {
    return success(
      { ...next, status: "COMPLETED" },
      true,
      "AGREEMENT_COMPLETED",
    );
  }
  return success(next, true, "PARTY_CONFIRMED_COMPLETION");
}
