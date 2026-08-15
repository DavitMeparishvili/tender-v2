"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
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

export type PublishTenderCopy = Readonly<{
  label: string;
  pendingLabel: string;
  hint: string;
  success: string;
  summaryOne: string;
  summaryMany: string;
  genericError: string;
  requiredError: string;
  shortDescriptionRequired: string;
  fullDescriptionRequired: string;
  scopeRequired: string;
  budgetRequired: string;
  locationRequired: string;
  deadlineRequired: string;
  deadlineNotFuture: string;
  notFound: string;
  notOwner: string;
  unavailable: string;
}>;

function publicationIssue(
  code: string | undefined,
  copy: PublishTenderCopy,
): FormIssue {
  const message = {
    TITLE_REQUIRED: copy.requiredError,
    SHORT_DESCRIPTION_REQUIRED: copy.shortDescriptionRequired,
    FULL_DESCRIPTION_REQUIRED: copy.fullDescriptionRequired,
    SCOPE_REQUIRED: copy.scopeRequired,
    BUDGET_REQUIRED: copy.budgetRequired,
    LOCATION_REQUIRED: copy.locationRequired,
    DEADLINE_REQUIRED: copy.deadlineRequired,
    DEADLINE_NOT_FUTURE: copy.deadlineNotFuture,
    TENDER_NOT_FOUND: copy.notFound,
    NOT_OWNER: copy.notOwner,
    NOT_DRAFT: copy.unavailable,
  }[code ?? ""];

  return {
    field: "publish-heading",
    message: message ?? copy.genericError,
  };
}

export function PublishTenderForm({
  copy,
  tenderId,
}: Readonly<{
  copy: PublishTenderCopy;
  tenderId: string;
}>) {
  const router = useRouter();
  const [issue, setIssue] = useState<FormIssue | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const focusRequest = useRef(false);

  useEffect(() => {
    if (!focusRequest.current || issue === null) return;
    focusRequest.current = false;
    focusErrorSummary("publish-errors");
  }, [issue]);

  function showIssue(nextIssue: FormIssue) {
    focusRequest.current = true;
    setIssue(nextIssue);
  }

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
        showIssue(publicationIssue(responseCode(body), copy));
        return;
      }

      setIsPublished(true);
      router.refresh();
    } catch {
      showIssue(publicationIssue(undefined, copy));
    } finally {
      setIsPending(false);
    }
  }

  if (isPublished) {
    return (
      <p className="success-status" role="status">
        {copy.success}
      </p>
    );
  }

  return (
    <form className="form-stack" onSubmit={onSubmit} noValidate>
      <ErrorSummary
        id="publish-errors"
        issues={issue ? [issue] : []}
        summaryOne={copy.summaryOne}
        summaryMany={copy.summaryMany}
      />
      <p className="tender-action-hint">{copy.hint}</p>
      <SubmitButton
        label={copy.label}
        pendingLabel={copy.pendingLabel}
        isPending={isPending}
      />
    </form>
  );
}
