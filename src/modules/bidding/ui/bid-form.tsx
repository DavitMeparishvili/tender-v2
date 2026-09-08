"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Field } from "../../identity/ui/field";
import {
  ErrorSummary,
  SubmitButton,
  focusErrorSummary,
  type FormIssue,
} from "../../identity/ui/identity-form";
import {
  reviseBidRequest,
  submitBidRequest,
  withdrawBidRequest,
} from "./bid-request";

export type BidFormCopy = Readonly<{
  amount: string;
  amountHint: string;
  proposedStartDate: string;
  durationDays: string;
  includedCosts: string;
  exclusions: string;
  conditions: string;
  conditionsHint: string;
  optional: string;
  submit: string;
  submitting: string;
  revise: string;
  revising: string;
  withdraw: string;
  withdrawing: string;
  submitted: string;
  revised: string;
  withdrawn: string;
  automaticWinner: string;
  revisionResetsQueue: string;
  summaryOne: string;
  summaryMany: string;
  genericError: string;
  errorsByCode: Readonly<Record<string, string>>;
}>;

export type ExistingBid = Readonly<{
  amountMinorUnits: number;
  proposedStartDate: Date | string | null;
  conditions: string;
  includedCosts: string | null;
  exclusions: string | null;
  durationDays: number | null;
}>;

function responseCode(value: unknown) {
  if (typeof value !== "object" || value === null || !("code" in value)) {
    return undefined;
  }
  return typeof value.code === "string" ? value.code : undefined;
}

// Major units in the input, integer minor units on the wire. The rounding
// happens once, here, so no floating-point amount ever reaches the API and
// the platform-wide integer-money rule holds end to end.
function toMinorUnits(major: string): number {
  return Math.round(Number.parseFloat(major) * 100);
}

function optionalText(value: FormDataEntryValue | null): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length === 0 ? undefined : text;
}

export function BidForm({
  copy,
  existing,
  tenderId,
}: Readonly<{
  copy: BidFormCopy;
  existing: ExistingBid | null;
  tenderId: string;
}>) {
  const router = useRouter();
  const [issue, setIssue] = useState<FormIssue | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const focusRequest = useRef(false);
  const isRevision = existing !== null;

  useEffect(() => {
    if (!focusRequest.current || issue === null) return;
    focusRequest.current = false;
    focusErrorSummary("bid-errors");
  }, [issue]);

  function showIssue(code: string | undefined, field: string) {
    focusRequest.current = true;
    setIssue({
      field,
      message: copy.errorsByCode[code ?? ""] ?? copy.genericError,
    });
  }

  async function send(request: RequestInit, path: string, success: string) {
    setIssue(null);
    setStatus(null);
    setIsPending(true);
    try {
      const response = await fetch(path, request);
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        showIssue(responseCode(body), "bid-amount");
        return;
      }
      setStatus(success);
      router.refresh();
    } catch {
      showIssue(undefined, "bid-amount");
    } finally {
      setIsPending(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const amount = toMinorUnits(String(data.get("amount") ?? ""));
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      showIssue("INVALID_INPUT", "bid-amount");
      return;
    }
    const duration = optionalText(data.get("durationDays"));
    const values = {
      amountMinorUnits: amount,
      ...(optionalText(data.get("proposedStartDate")) === undefined
        ? {}
        : { proposedStartDate: String(data.get("proposedStartDate")) }),
      ...(duration === undefined
        ? {}
        : { durationDays: Number.parseInt(duration, 10) }),
      ...(optionalText(data.get("includedCosts")) === undefined
        ? {}
        : { includedCosts: String(data.get("includedCosts")).trim() }),
      ...(optionalText(data.get("exclusions")) === undefined
        ? {}
        : { exclusions: String(data.get("exclusions")).trim() }),
      conditions: String(data.get("conditions") ?? "").trim(),
    };

    await (isRevision
      ? send(
          reviseBidRequest(values),
          `/api/tenders/${tenderId}/bids/mine`,
          copy.revised,
        )
      : send(
          submitBidRequest(values),
          `/api/tenders/${tenderId}/bids`,
          copy.submitted,
        ));
  }

  async function onWithdraw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await send(
      withdrawBidRequest,
      `/api/tenders/${tenderId}/bids/mine`,
      copy.withdrawn,
    );
  }

  return (
    <>
      <form className="bid-form form-stack" onSubmit={onSubmit} noValidate>
        <ErrorSummary
          id="bid-errors"
          issues={issue ? [issue] : []}
          summaryOne={copy.summaryOne}
          summaryMany={copy.summaryMany}
        />
        <Field
          id="bid-amount"
          label={copy.amount}
          description={copy.amountHint}
        >
          <input
            name="amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            required
            defaultValue={
              existing === null ? "" : String(existing.amountMinorUnits / 100)
            }
          />
        </Field>
        <Field
          id="bid-start"
          label={copy.proposedStartDate}
          description={copy.optional}
        >
          <input
            name="proposedStartDate"
            type="date"
            defaultValue={
              existing?.proposedStartDate
                ? new Date(existing.proposedStartDate)
                    .toISOString()
                    .slice(0, 10)
                : ""
            }
          />
        </Field>
        <Field
          id="bid-duration"
          label={copy.durationDays}
          description={copy.optional}
        >
          <input
            name="durationDays"
            type="number"
            min="1"
            step="1"
            defaultValue={existing?.durationDays ?? ""}
          />
        </Field>
        <Field
          id="bid-included"
          label={copy.includedCosts}
          description={copy.optional}
        >
          <textarea
            name="includedCosts"
            rows={2}
            defaultValue={existing?.includedCosts ?? ""}
          />
        </Field>
        <Field
          id="bid-exclusions"
          label={copy.exclusions}
          description={copy.optional}
        >
          <textarea
            name="exclusions"
            rows={2}
            defaultValue={existing?.exclusions ?? ""}
          />
        </Field>
        <Field
          id="bid-conditions"
          label={copy.conditions}
          description={copy.conditionsHint}
        >
          <textarea
            name="conditions"
            rows={4}
            required
            minLength={30}
            defaultValue={existing?.conditions ?? ""}
          />
        </Field>
        {/*
          The two facts the provider must have before confirming: the winner is
          automatic, and a revision costs them their queue position.
        */}
        <p className="tender-action-hint">{copy.automaticWinner}</p>
        {isRevision ? (
          <p className="tender-action-hint">{copy.revisionResetsQueue}</p>
        ) : null}
        <SubmitButton
          label={isRevision ? copy.revise : copy.submit}
          pendingLabel={isRevision ? copy.revising : copy.submitting}
          isPending={isPending}
        />
      </form>
      {isRevision ? (
        <form className="form-stack" onSubmit={onWithdraw} noValidate>
          <SubmitButton
            label={copy.withdraw}
            pendingLabel={copy.withdrawing}
            isPending={isPending}
          />
        </form>
      ) : null}
      {status === null ? null : (
        <p className="success-status" role="status">
          {status}
        </p>
      )}
    </>
  );
}
