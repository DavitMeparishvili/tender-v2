"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ErrorSummary,
  SubmitButton,
  focusErrorSummary,
  type FormIssue,
} from "../../identity/ui/identity-form";
import { Field } from "../../identity/ui/field";
import { cancelTenderRequest } from "./tender-mutation-request";

function responseCode(value: unknown) {
  if (typeof value !== "object" || value === null || !("code" in value)) {
    return undefined;
  }
  return typeof value.code === "string" ? value.code : undefined;
}

export type CancelTenderCopy = Readonly<{
  label: string;
  pendingLabel: string;
  reasonLabel: string;
  reasonHint: string;
  success: string;
  summaryOne: string;
  summaryMany: string;
  requiredError: string;
  invalidError: string;
  notFound: string;
  notOwner: string;
  alreadyCancelled: string;
  genericError: string;
}>;

function cancellationIssue(
  code: string | undefined,
  copy: CancelTenderCopy,
): FormIssue {
  const message = {
    INVALID_INPUT: copy.invalidError,
    TENDER_NOT_FOUND: copy.notFound,
    NOT_OWNER: copy.notOwner,
    ALREADY_CANCELLED: copy.alreadyCancelled,
  }[code ?? ""];

  return {
    field: "cancelReason",
    message: message ?? copy.genericError,
  };
}

export function CancelTenderForm({
  copy,
  tenderId,
}: Readonly<{
  copy: CancelTenderCopy;
  tenderId: string;
}>) {
  const router = useRouter();
  const [issue, setIssue] = useState<FormIssue | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const focusRequest = useRef(false);

  useEffect(() => {
    if (!focusRequest.current || issue === null) return;
    focusRequest.current = false;
    focusErrorSummary("cancel-errors");
  }, [issue]);

  function showIssue(nextIssue: FormIssue) {
    focusRequest.current = true;
    setIssue(nextIssue);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const reason = String(new FormData(form).get("cancelReason") ?? "").trim();

    if (reason.length < 5) {
      showIssue({
        field: "cancelReason",
        message: reason.length === 0 ? copy.requiredError : copy.invalidError,
      });
      return;
    }

    setIssue(null);
    setIsPending(true);

    try {
      const response = await fetch(
        `/api/tenders/${tenderId}/cancel`,
        cancelTenderRequest(reason),
      );

      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        showIssue(cancellationIssue(responseCode(body), copy));
        return;
      }

      setIsCancelled(true);
      router.refresh();
    } catch {
      showIssue(cancellationIssue(undefined, copy));
    } finally {
      setIsPending(false);
    }
  }

  if (isCancelled) {
    return (
      <p className="success-status" role="status">
        {copy.success}
      </p>
    );
  }

  return (
    <form className="form-stack" onSubmit={onSubmit} noValidate>
      <ErrorSummary
        id="cancel-errors"
        issues={issue ? [issue] : []}
        summaryOne={copy.summaryOne}
        summaryMany={copy.summaryMany}
      />
      <Field
        id="cancelReason"
        label={copy.reasonLabel}
        description={copy.reasonHint}
        error={issue?.field === "cancelReason" ? issue.message : undefined}
      >
        <textarea
          name="cancelReason"
          required
          minLength={5}
          maxLength={500}
          disabled={isPending}
        />
      </Field>
      <SubmitButton
        label={copy.label}
        pendingLabel={copy.pendingLabel}
        isPending={isPending}
      />
    </form>
  );
}
