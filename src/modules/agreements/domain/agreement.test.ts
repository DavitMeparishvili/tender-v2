import { describe, expect, it } from "vitest";
import {
  AGREEMENT_CONFIRMATION_WINDOW_MS,
  confirmationDeadline,
  transitionAgreement,
  type AgreementRecord,
} from "./agreement";

function agreementRecord(
  overrides: Partial<AgreementRecord> = {},
): AgreementRecord {
  return {
    id: "agreement-1",
    clientId: "client-1",
    providerId: "provider-1",
    status: "PENDING_CONFIRMATION",
    confirmDeadline: new Date("2026-08-18T10:00:00.000Z"),
    clientConfirmedAt: null,
    providerConfirmedAt: null,
    clientStartedAt: null,
    providerStartedAt: null,
    clientCompletedAt: null,
    providerCompletedAt: null,
    cancelledAt: null,
    cancelledById: null,
    cancellationReasonCode: null,
    cancellationExplanation: null,
    ...overrides,
  };
}

describe("confirmationDeadline", () => {
  it("gives both parties exactly 48 hours to confirm", () => {
    expect(AGREEMENT_CONFIRMATION_WINDOW_MS).toBe(48 * 60 * 60 * 1000);
    expect(confirmationDeadline(new Date("2026-07-01T09:00:00.000Z"))).toEqual(
      new Date("2026-07-03T09:00:00.000Z"),
    );
  });

  it("does not mutate the instant it is given", () => {
    const now = new Date("2026-07-01T09:00:00.000Z");
    confirmationDeadline(now);
    expect(now.toISOString()).toBe("2026-07-01T09:00:00.000Z");
  });
});

describe("transitionAgreement", () => {
  const beforeDeadline = new Date("2026-08-18T09:59:59.999Z");

  it("becomes agreed only after both parties confirm before the deadline", () => {
    const pending = agreementRecord();
    const first = transitionAgreement(
      pending,
      { type: "CONFIRM", actorId: pending.clientId },
      beforeDeadline,
    );
    expect(first).toMatchObject({
      ok: true,
      value: {
        record: { status: "PENDING_CONFIRMATION" },
        event: "PARTY_CONFIRMED",
      },
    });
    if (!first.ok) throw new Error("expected first confirmation");
    expect(
      transitionAgreement(
        first.value.record,
        { type: "CONFIRM", actorId: pending.providerId },
        beforeDeadline,
      ),
    ).toMatchObject({
      ok: true,
      value: { record: { status: "AGREED" }, event: "AGREEMENT_AGREED" },
    });
  });

  it("expires at the exact confirmation deadline", () => {
    const pending = agreementRecord();
    expect(
      transitionAgreement(
        pending,
        { type: "EXPIRE", actorId: null },
        pending.confirmDeadline,
      ),
    ).toMatchObject({
      ok: true,
      value: {
        record: {
          status: "CANCELLED",
          cancellationReasonCode: "CONFIRMATION_EXPIRED",
        },
        event: "AGREEMENT_EXPIRED",
      },
    });
    expect(
      transitionAgreement(
        pending,
        { type: "CONFIRM", actorId: pending.clientId },
        pending.confirmDeadline,
      ),
    ).toEqual({ ok: false, error: "CONFIRMATION_EXPIRED" });
  });

  it("rejects outsiders and wrong-state actions", () => {
    const pending = agreementRecord();
    expect(
      transitionAgreement(
        pending,
        { type: "CONFIRM", actorId: "outsider" },
        beforeDeadline,
      ),
    ).toEqual({ ok: false, error: "NOT_PARTICIPANT" });
    expect(
      transitionAgreement(
        pending,
        { type: "ACKNOWLEDGE_START", actorId: pending.clientId },
        beforeDeadline,
      ),
    ).toEqual({ ok: false, error: "INVALID_STATE" });
  });

  it("makes a participant double-confirm retry idempotent", () => {
    const pending = agreementRecord();
    const first = transitionAgreement(
      pending,
      { type: "CONFIRM", actorId: pending.clientId },
      beforeDeadline,
    );
    if (!first.ok) throw new Error("expected confirmation");
    expect(
      transitionAgreement(
        first.value.record,
        { type: "CONFIRM", actorId: pending.clientId },
        beforeDeadline,
      ),
    ).toMatchObject({
      ok: true,
      value: { changed: false, event: "PARTY_CONFIRMED" },
    });
  });

  it("declines before the deadline and only expires when due", () => {
    const pending = agreementRecord();
    expect(
      transitionAgreement(
        pending,
        { type: "EXPIRE", actorId: null },
        beforeDeadline,
      ),
    ).toEqual({ ok: false, error: "NOT_DUE" });
    expect(
      transitionAgreement(
        pending,
        {
          type: "DECLINE",
          actorId: pending.providerId,
          explanation: " Scheduling cannot proceed at this time. ",
        },
        beforeDeadline,
      ),
    ).toMatchObject({
      ok: true,
      value: {
        record: {
          status: "CANCELLED",
          cancellationReasonCode: "PARTY_DECLINED",
          cancellationExplanation: "Scheduling cannot proceed at this time.",
        },
        event: "AGREEMENT_DECLINED",
      },
    });
  });

  it("starts and completes after both party acknowledgements", () => {
    const agreed = agreementRecord({
      status: "AGREED",
      clientConfirmedAt: beforeDeadline,
      providerConfirmedAt: beforeDeadline,
    });
    const firstStart = transitionAgreement(
      agreed,
      { type: "ACKNOWLEDGE_START", actorId: agreed.providerId },
      beforeDeadline,
    );
    if (!firstStart.ok) throw new Error("expected start acknowledgement");
    expect(firstStart.value).toMatchObject({
      event: "PARTY_ACKNOWLEDGED_START",
    });
    const started = transitionAgreement(
      firstStart.value.record,
      { type: "ACKNOWLEDGE_START", actorId: agreed.clientId },
      beforeDeadline,
    );
    if (!started.ok) throw new Error("expected work start");
    expect(started.value).toMatchObject({
      record: { status: "IN_PROGRESS" },
      event: "WORK_STARTED",
    });
    const firstCompletion = transitionAgreement(
      started.value.record,
      { type: "CONFIRM_COMPLETION", actorId: agreed.clientId },
      beforeDeadline,
    );
    if (!firstCompletion.ok)
      throw new Error("expected completion acknowledgement");
    expect(firstCompletion.value).toMatchObject({
      event: "PARTY_CONFIRMED_COMPLETION",
    });
    expect(
      transitionAgreement(
        firstCompletion.value.record,
        { type: "CONFIRM_COMPLETION", actorId: agreed.providerId },
        beforeDeadline,
      ),
    ).toMatchObject({
      ok: true,
      value: { record: { status: "COMPLETED" }, event: "AGREEMENT_COMPLETED" },
    });
  });

  it("is idempotent for start and completion retries and supports neutral cancellation", () => {
    const inProgress = agreementRecord({
      status: "IN_PROGRESS",
      clientStartedAt: beforeDeadline,
      providerStartedAt: beforeDeadline,
    });
    expect(
      transitionAgreement(
        inProgress,
        { type: "ACKNOWLEDGE_START", actorId: inProgress.clientId },
        beforeDeadline,
      ),
    ).toMatchObject({ ok: true, value: { changed: false } });
    expect(
      transitionAgreement(
        inProgress,
        {
          type: "CANCEL",
          actorId: inProgress.clientId,
          reasonCode: "OTHER",
          explanation: " The scope cannot proceed as currently planned. ",
        },
        beforeDeadline,
      ),
    ).toMatchObject({
      ok: true,
      value: { record: { status: "CANCELLED" }, event: "AGREEMENT_CANCELLED" },
    });
  });

  it("allows cancellation from AGREED and makes completion retries idempotent", () => {
    const agreed = agreementRecord({
      status: "AGREED",
      clientConfirmedAt: beforeDeadline,
      providerConfirmedAt: beforeDeadline,
    });
    expect(
      transitionAgreement(
        agreed,
        {
          type: "CANCEL",
          actorId: agreed.providerId,
          reasonCode: "SCHEDULE_CHANGED",
          explanation: "The schedule cannot proceed as currently planned.",
        },
        beforeDeadline,
      ),
    ).toMatchObject({
      ok: true,
      value: { record: { status: "CANCELLED" }, event: "AGREEMENT_CANCELLED" },
    });
    const firstCompletion = transitionAgreement(
      agreementRecord({
        status: "IN_PROGRESS",
        clientStartedAt: beforeDeadline,
        providerStartedAt: beforeDeadline,
      }),
      { type: "CONFIRM_COMPLETION", actorId: agreed.providerId },
      beforeDeadline,
    );
    if (!firstCompletion.ok)
      throw new Error("expected completion confirmation");
    expect(
      transitionAgreement(
        firstCompletion.value.record,
        { type: "CONFIRM_COMPLETION", actorId: agreed.providerId },
        beforeDeadline,
      ),
    ).toMatchObject({
      ok: true,
      value: { changed: false, event: "PARTY_CONFIRMED_COMPLETION" },
    });
  });

  it.each(["COMPLETED", "CANCELLED"] as const)(
    "rejects every action for terminal %s agreements",
    (status) => {
      const terminal = agreementRecord({ status });
      const actions = [
        { type: "CONFIRM", actorId: terminal.clientId },
        {
          type: "DECLINE",
          actorId: terminal.clientId,
          explanation: "This explanation contains enough neutral detail.",
        },
        { type: "ACKNOWLEDGE_START", actorId: terminal.clientId },
        { type: "CONFIRM_COMPLETION", actorId: terminal.clientId },
        {
          type: "CANCEL",
          actorId: terminal.clientId,
          reasonCode: "OTHER" as const,
          explanation: "This explanation contains enough neutral detail.",
        },
        { type: "EXPIRE", actorId: null },
      ] as const;
      for (const action of actions) {
        expect(transitionAgreement(terminal, action, beforeDeadline)).toEqual({
          ok: false,
          error: "INVALID_STATE",
        });
      }
    },
  );

  it("does not reveal terminal state to an outsider", () => {
    expect(
      transitionAgreement(
        agreementRecord({ status: "COMPLETED" }),
        { type: "CONFIRM", actorId: "outsider" },
        beforeDeadline,
      ),
    ).toEqual({ ok: false, error: "NOT_PARTICIPANT" });
  });
});
