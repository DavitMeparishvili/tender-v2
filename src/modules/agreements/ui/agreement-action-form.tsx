"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
type Action =
  "CONFIRM" | "ACKNOWLEDGE_START" | "CONFIRM_COMPLETION" | "DECLINE" | "CANCEL";
export function AgreementActionForm({
  agreementId,
  action,
  label,
}: {
  agreementId: string;
  action: Action;
  label: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsReason = action === "DECLINE" || action === "CANCEL";
  async function submit(form: FormData) {
    setPending(true);
    setError(null);
    const explanation = String(form.get("explanation") ?? "");
    const body =
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
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError("Unable to record this action.");
        setPending(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Unable to record this action.");
      setPending(false);
    }
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit(new FormData(event.currentTarget));
      }}
    >
      {needsReason ? (
        <>
          <p>
            The platform records this reason and does not determine fault or
            resolve payment or legal disputes.
          </p>
          {action === "CANCEL" ? (
            <label>
              Reason code
              <select name="reasonCode" defaultValue="OTHER">
                <option value="SCHEDULE_CHANGED">Schedule changed</option>
                <option value="SCOPE_CANNOT_PROCEED">
                  Scope cannot proceed
                </option>
                <option value="OTHER">Other</option>
              </select>
            </label>
          ) : null}
          <label>
            Explanation
            <textarea
              name="explanation"
              required
              minLength={10}
              maxLength={1000}
            />
          </label>
        </>
      ) : null}
      <button
        className="button button-primary"
        type="submit"
        disabled={pending}
      >
        {label}
        {pending ? "…" : ""}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
