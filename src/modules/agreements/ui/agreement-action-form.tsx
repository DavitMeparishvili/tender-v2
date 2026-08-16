"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Messages } from "../../localization/get-messages";
import { Field } from "../../identity/ui/field";

type Action =
  "CONFIRM" | "ACKNOWLEDGE_START" | "CONFIRM_COMPLETION" | "DECLINE" | "CANCEL";

export function AgreementActionForm({
  agreementId,
  action,
  copy,
  label,
}: Readonly<{
  agreementId: string;
  action: Action;
  copy: Messages["agreements"];
  label: string;
}>) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const needsReason = action === "DECLINE" || action === "CANCEL";
  const pendingId = `agreement-action-pending-${action}`;

  async function submit(form: FormData) {
    setPending(true);
    setError(null);
    setSuccess(false);
    const explanation = String(form.get("explanation") ?? "");
    const command =
      action === "DECLINE"
        ? { action, explanation }
        : action === "CANCEL"
          ? {
              action,
              reasonCode: String(form.get("reasonCode") ?? "OTHER"),
              explanation,
            }
          : { action };
    try {
      const response = await fetch(`/api/agreements/${agreementId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(command),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          code?: keyof typeof copy.errors;
        } | null;
        setError(
          body?.code && body.code in copy.errors
            ? copy.errors[body.code]
            : copy.errors.generic,
        );
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch {
      setError(copy.errors.generic);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className={
        needsReason
          ? "agreement-action-form agreement-action-form-danger"
          : "agreement-action-form"
      }
      onSubmit={(event) => {
        event.preventDefault();
        void submit(new FormData(event.currentTarget));
      }}
    >
      {needsReason ? (
        <>
          <p className="tender-action-hint">{copy.disclaimer}</p>
          <p className="tender-action-hint">
            {action === "DECLINE"
              ? copy.declineConsequence
              : copy.cancelConsequence}
          </p>
          {action === "CANCEL" ? (
            <Field id={`reasonCode-${action}`} label={copy.reasonCode}>
              <select name="reasonCode" defaultValue="OTHER">
                <option value="SCHEDULE_CHANGED">
                  {copy.reasonScheduleChanged}
                </option>
                <option value="SCOPE_CANNOT_PROCEED">
                  {copy.reasonScopeCannotProceed}
                </option>
                <option value="OTHER">{copy.reasonOther}</option>
              </select>
            </Field>
          ) : null}
          <Field id={`explanation-${action}`} label={copy.explanation}>
            <textarea
              name="explanation"
              required
              minLength={10}
              maxLength={1000}
            />
          </Field>
        </>
      ) : null}
      <button
        aria-describedby={pending ? pendingId : undefined}
        className={
          needsReason ? "button button-danger" : "button button-primary"
        }
        disabled={pending}
        type="submit"
      >
        <span>{label}</span>
        {pending ? (
          <span className="button-status" id={pendingId} role="status">
            {copy.submitting}
          </span>
        ) : null}
      </button>
      {success ? (
        <p className="success-status" role="status">
          {copy.success}
        </p>
      ) : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
