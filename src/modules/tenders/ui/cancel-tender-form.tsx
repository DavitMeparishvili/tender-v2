"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Messages } from "../../localization/get-messages";
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

function cancellationIssue(
  code: string | undefined,
  messages: Messages,
): FormIssue {
  const message = {
    INVALID_INPUT: messages.tenders.errors.invalidInput,
    TENDER_NOT_FOUND: messages.tenders.errors.notFound,
    NOT_OWNER: messages.tenders.errors.notOwner,
    ALREADY_CANCELLED: messages.tenders.errors.alreadyCancelled,
  }[code ?? ""];

  return {
    field: "cancelReason",
    message: message ?? messages.errors.generic,
  };
}

export function CancelTenderForm({
  messages,
  tenderId,
}: Readonly<{
  messages: Messages;
  tenderId: string;
}>) {
  const router = useRouter();
  const [issue, setIssue] = useState<FormIssue | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const reason = String(new FormData(form).get("cancelReason") ?? "").trim();

    if (reason.length < 5) {
      setIssue({
        field: "cancelReason",
        message:
          reason.length === 0
            ? messages.errors.required
            : messages.tenders.errors.invalidInput,
      });
      queueMicrotask(() => focusErrorSummary("cancel-errors"));
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
        setIssue(cancellationIssue(responseCode(body), messages));
        queueMicrotask(() => focusErrorSummary("cancel-errors"));
        return;
      }

      setIsCancelled(true);
      router.refresh();
    } catch {
      setIssue(cancellationIssue(undefined, messages));
      queueMicrotask(() => focusErrorSummary("cancel-errors"));
    } finally {
      setIsPending(false);
    }
  }

  if (isCancelled) {
    return (
      <p className="success-status" role="status">
        {messages.tenders.statusCancelled}
      </p>
    );
  }

  return (
    <form className="form-stack" onSubmit={onSubmit} noValidate>
      <ErrorSummary
        id="cancel-errors"
        issues={issue ? [issue] : []}
        summaryOne={messages.errors.summaryOne}
        summaryMany={messages.errors.summaryMany}
      />
      <Field
        id="cancelReason"
        label={messages.tenders.cancelReason}
        description={messages.tenders.cancelReasonHint}
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
        label={messages.tenders.cancel}
        pendingLabel={messages.tenders.cancelling}
        isPending={isPending}
      />
    </form>
  );
}
