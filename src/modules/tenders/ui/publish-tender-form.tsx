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
import { publishTenderRequest } from "./tender-mutation-request";

function responseCode(value: unknown) {
  if (typeof value !== "object" || value === null || !("code" in value)) {
    return undefined;
  }
  return typeof value.code === "string" ? value.code : undefined;
}

function publicationIssue(
  code: string | undefined,
  messages: Messages,
): FormIssue {
  const message = {
    TITLE_REQUIRED: messages.errors.required,
    SHORT_DESCRIPTION_REQUIRED:
      messages.tenders.errors.shortDescriptionRequired,
    FULL_DESCRIPTION_REQUIRED: messages.tenders.errors.fullDescriptionRequired,
    SCOPE_REQUIRED: messages.tenders.errors.scopeRequired,
    BUDGET_REQUIRED: messages.tenders.errors.budgetRequired,
    LOCATION_REQUIRED: messages.tenders.errors.locationRequired,
    DEADLINE_REQUIRED: messages.tenders.errors.deadlineRequired,
    DEADLINE_NOT_FUTURE: messages.tenders.errors.deadlineNotFuture,
    TENDER_NOT_FOUND: messages.tenders.errors.notFound,
    NOT_OWNER: messages.tenders.errors.notOwner,
    NOT_DRAFT: messages.tenders.publishUnavailable,
  }[code ?? ""];

  return {
    field: "publish-heading",
    message: message ?? messages.errors.generic,
  };
}

export function PublishTenderForm({
  messages,
  tenderId,
}: Readonly<{
  messages: Messages;
  tenderId: string;
}>) {
  const router = useRouter();
  const [issue, setIssue] = useState<FormIssue | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIssue(null);
    setIsPending(true);

    try {
      const response = await fetch(
        `/api/tenders/${tenderId}/publish`,
        publishTenderRequest,
      );

      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        setIssue(publicationIssue(responseCode(body), messages));
        queueMicrotask(() => focusErrorSummary("publish-errors"));
        return;
      }

      setIsPublished(true);
      router.refresh();
    } catch {
      setIssue(publicationIssue(undefined, messages));
      queueMicrotask(() => focusErrorSummary("publish-errors"));
    } finally {
      setIsPending(false);
    }
  }

  if (isPublished) {
    return (
      <p className="success-status" role="status">
        {messages.tenders.statusPublished}
      </p>
    );
  }

  return (
    <form className="form-stack" onSubmit={onSubmit} noValidate>
      <ErrorSummary
        id="publish-errors"
        issues={issue ? [issue] : []}
        summaryOne={messages.errors.summaryOne}
        summaryMany={messages.errors.summaryMany}
      />
      <p className="tender-action-hint">{messages.tenders.publishHint}</p>
      <SubmitButton
        label={messages.tenders.publish}
        pendingLabel={messages.tenders.publishing}
        isPending={isPending}
      />
    </form>
  );
}
