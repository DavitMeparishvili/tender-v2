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
import { reviseBidRequest, submitBidRequest } from "./bid-request";

import { AmountInput } from "../../tenders/ui/amount-input";
import {
  bidAmountMinorUnits,
  validateBidForm,
  type BidValidationCopy,
} from "./bid-form-validation";
import {
  MAX_BID_CONDITIONS_LENGTH,
  MAX_BID_DURATION_DAYS,
  MAX_BID_TERM_LENGTH,
  MIN_BID_CONDITIONS_LENGTH,
} from "../domain/constraints";

export type BidFormCopy = Readonly<{
  cancel: string;
  amount: string;
  amountHint: string;
  proposedStartDate: string;
  durationDays: string;
  includedCosts: string;
  exclusions: string;
  conditions: string;
  conditionsHint: string;
  optional: string;
  required: string;
  durationHint: string;
  validation: BidValidationCopy;
  submit: string;
  submitting: string;
  revise: string;
  revising: string;
  withdraw: string;
  withdrawing: string;
  submitted: string;
  revised: string;
  withdrawn: string;
  selectionRule: string;
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

function optionalText(value: FormDataEntryValue | null): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length === 0 ? undefined : text;
}

export function BidForm({
  copy,
  existing,
  tenderId,
  currency,
  onSaved,
  onCancel,
}: Readonly<{
  copy: BidFormCopy;
  existing: ExistingBid | null;
  tenderId: string;
  currency: string;
  onSaved?: () => void;
  onCancel?: (() => void) | undefined;
}>) {
  const router = useRouter();
  const [issues, setIssues] = useState<FormIssue[]>([]);
  const [amount, setAmount] = useState(
    existing === null
      ? ""
      : (existing.amountMinorUnits / 100).toFixed(
          existing.amountMinorUnits % 100 ? 2 : 0,
        ),
  );
  const fieldError = (field: string) =>
    issues.find((issue) => issue.field === field)?.message;
  const [isPending, setIsPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const focusRequest = useRef(false);
  const isRevision = existing !== null;

  useEffect(() => {
    if (!focusRequest.current || issues.length === 0) return;
    focusRequest.current = false;
    focusErrorSummary("bid-errors");
  }, [issues]);

  function showIssue(code: string | undefined, field: string) {
    focusRequest.current = true;
    setIssues([
      {
        field,
        message: copy.errorsByCode[code ?? ""] ?? copy.genericError,
      },
    ]);
  }

  async function send(request: RequestInit, path: string, success: string) {
    setIssues([]);
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
      onSaved?.();
    } catch {
      showIssue(undefined, "bid-amount");
    } finally {
      setIsPending(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (isPending) return;
    setStatus(null);
    const validation = validateBidForm(data, amount, {
      ...copy.validation,
      amount: copy.validation.amount.replace("{currency}", currency),
    });
    if (validation.length) {
      focusRequest.current = true;
      setIssues(validation);
      return;
    }
    const values = {
      amountMinorUnits: bidAmountMinorUnits(amount)!,
      ...(optionalText(data.get("proposedStartDate")) === undefined
        ? {}
        : { proposedStartDate: String(data.get("proposedStartDate")) }),
      durationDays: Number(data.get("durationDays")),
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

  return (
    <>
      <form className="bid-form form-stack" onSubmit={onSubmit} noValidate>
        <ErrorSummary
          id="bid-errors"
          issues={issues}
          summaryOne={copy.summaryOne}
          summaryMany={copy.summaryMany}
        />
        <Field
          id="bid-amount"
          label={copy.amount}
          description={copy.amountHint.replace("{currency}", currency)}
          requirement={copy.required}
          error={fieldError("bid-amount")}
          suffix={<span className="field-currency">{currency}</span>}
        >
          <AmountInput
            name="amount"
            required
            value={amount}
            onChange={setAmount}
          />
        </Field>
        <Field
          id="bid-start"
          label={copy.proposedStartDate}
          requirement={copy.optional}
          error={fieldError("bid-start")}
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
          requirement={copy.required}
          description={copy.durationHint}
          error={fieldError("bid-duration")}
        >
          <input
            name="durationDays"
            required
            max={MAX_BID_DURATION_DAYS}
            type="number"
            min="1"
            step="1"
            defaultValue={existing?.durationDays ?? ""}
          />
        </Field>
        <Field
          id="bid-included"
          label={copy.includedCosts}
          requirement={copy.optional}
          error={fieldError("bid-included")}
        >
          <textarea
            name="includedCosts"
            maxLength={MAX_BID_TERM_LENGTH}
            rows={2}
            defaultValue={existing?.includedCosts ?? ""}
          />
        </Field>
        <Field
          id="bid-exclusions"
          label={copy.exclusions}
          requirement={copy.optional}
          error={fieldError("bid-exclusions")}
        >
          <textarea
            name="exclusions"
            maxLength={MAX_BID_TERM_LENGTH}
            rows={2}
            defaultValue={existing?.exclusions ?? ""}
          />
        </Field>
        <Field
          id="bid-conditions"
          label={copy.conditions}
          description={copy.conditionsHint}
          requirement={copy.required}
          error={fieldError("bid-conditions")}
        >
          <textarea
            name="conditions"
            rows={4}
            required
            minLength={MIN_BID_CONDITIONS_LENGTH}
            maxLength={MAX_BID_CONDITIONS_LENGTH}
            defaultValue={existing?.conditions ?? ""}
          />
        </Field>
        {/*
          The two facts the provider must have before confirming: the client
          chooses the contractor, and a revision costs them their place in the
          lowest-price-first listing.
        */}
        <p className="tender-action-hint">{copy.selectionRule}</p>
        {isRevision ? (
          <p className="tender-action-hint">{copy.revisionResetsQueue}</p>
        ) : null}
        <SubmitButton
          label={isRevision ? copy.revise : copy.submit}
          pendingLabel={isRevision ? copy.revising : copy.submitting}
          isPending={isPending}
        />
      </form>
      {onCancel ? (
        <button
          type="button"
          className="tender-button"
          disabled={isPending}
          onClick={onCancel}
        >
          {copy.cancel}
        </button>
      ) : null}
      {status === null ? null : (
        <p className="success-status" role="status">
          {status}
        </p>
      )}
    </>
  );
}
