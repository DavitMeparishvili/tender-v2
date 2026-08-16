"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ErrorSummary,
  focusErrorSummary,
  type FormIssue,
} from "../../identity/ui/identity-form";
import type { AccessProductCode } from "../domain/access-product";

export type AccessCheckoutCopy = Readonly<{
  label: string;
  /** Secondary line and price, rendered only by the option variant. */
  note?: string;
  price?: string;
  pendingLabel: string;
  summaryOne: string;
  summaryMany: string;
  genericError: string;
  alreadyEntitled: string;
  paymentFailed: string;
  checkoutNotFound: string;
}>;

function responseCode(value: unknown) {
  if (typeof value !== "object" || value === null || !("code" in value)) {
    return undefined;
  }
  return typeof value.code === "string" ? value.code : undefined;
}

function checkoutIssue(
  code: string | undefined,
  copy: AccessCheckoutCopy,
  field: string,
): FormIssue {
  const message = {
    ALREADY_ENTITLED: copy.alreadyEntitled,
    PAYMENT_FAILED: copy.paymentFailed,
    CHECKOUT_NOT_FOUND: copy.checkoutNotFound,
    NOT_CHECKOUT_OWNER: copy.checkoutNotFound,
  }[code ?? ""];
  return { field, message: message ?? copy.genericError };
}

export function AccessCheckoutForm({
  copy,
  product,
  tenderId,
  variant = "primary",
}: Readonly<{
  copy: AccessCheckoutCopy;
  product: AccessProductCode;
  tenderId: string;
  /** `primary` is the gold action; `option` is an outlined subscription row. */
  variant?: "primary" | "option";
}>) {
  const router = useRouter();
  const [issue, setIssue] = useState<FormIssue | null>(null);
  const [isPending, setIsPending] = useState(false);
  const focusRequest = useRef(false);
  const errorsId = `checkout-errors-${product}`;

  useEffect(() => {
    if (!focusRequest.current || issue === null) return;
    focusRequest.current = false;
    focusErrorSummary(errorsId);
  }, [errorsId, issue]);

  function showIssue(next: FormIssue) {
    focusRequest.current = true;
    setIssue(next);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIssue(null);
    setIsPending(true);

    try {
      // Two steps on purpose: `checkout` is where a Phase 5 hosted provider
      // will redirect, and `confirm` is where its webhook will land. Keeping
      // both now means swapping the adapter later changes no call site.
      const started = await fetch("/api/access/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          product,
          ...(product === "SINGLE_TENDER" ? { tenderId } : {}),
        }),
      });
      if (!started.ok) {
        const body: unknown = await started.json().catch(() => null);
        showIssue(checkoutIssue(responseCode(body), copy, errorsId));
        return;
      }

      const { checkout } = (await started.json()) as {
        checkout: { confirmPath: string };
      };
      const confirmed = await fetch(checkout.confirmPath, { method: "POST" });
      if (!confirmed.ok) {
        const body: unknown = await confirmed.json().catch(() => null);
        showIssue(checkoutIssue(responseCode(body), copy, errorsId));
        return;
      }

      router.refresh();
    } catch {
      showIssue(checkoutIssue(undefined, copy, errorsId));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={onSubmit} noValidate>
      <ErrorSummary
        id={errorsId}
        issues={issue ? [issue] : []}
        summaryOne={copy.summaryOne}
        summaryMany={copy.summaryMany}
      />
      {variant === "primary" ? (
        <button
          aria-describedby={isPending ? `${errorsId}-pending` : undefined}
          className="pill pill-brand unlock-primary"
          disabled={isPending}
          type="submit"
        >
          <span>{copy.label}</span>
          {isPending ? (
            <span
              className="button-status"
              id={`${errorsId}-pending`}
              role="status"
            >
              {copy.pendingLabel}
            </span>
          ) : null}
        </button>
      ) : (
        <button className="unlock-option" disabled={isPending} type="submit">
          <span>
            <span className="unlock-option-name">{copy.label}</span>
            {copy.note ? (
              <span className="unlock-option-note">
                {isPending ? copy.pendingLabel : copy.note}
              </span>
            ) : null}
          </span>
          {copy.price ? (
            <span className="unlock-option-price">{copy.price}</span>
          ) : null}
        </button>
      )}
    </form>
  );
}
