"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

export type ChooseBidCopy = Readonly<{
  choose: string;
  confirmTitle: string;
  confirmBody: string;
  confirm: string;
  keep: string;
  choosing: string;
  errorsByCode: Readonly<Record<string, string>>;
  genericError: string;
}>;

// Two steps, like withdrawing an offer: the first press only explains that
// choosing closes the tender; the second press records the choice.
export function ChooseBidButton({
  tenderId,
  bidId,
  providerName,
  copy,
}: Readonly<{
  tenderId: string;
  bidId: string;
  providerName: string;
  copy: ChooseBidCopy;
}>) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  // Each step replaces the control that was pressed, so focus is moved on
  // purpose rather than falling back to the top of the page: into the
  // confirmation when it opens, back to the choose button when it closes.
  const confirmHeading = useRef<HTMLHeadingElement>(null);
  const chooseButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (confirming) {
      confirmHeading.current?.focus();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      chooseButton.current?.focus();
    }
  }, [confirming]);

  function closeConfirmation() {
    returnFocus.current = true;
    setConfirming(false);
  }

  async function choose() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/tenders/${encodeURIComponent(tenderId)}/bids/${encodeURIComponent(bidId)}/choose`,
        { method: "POST" },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          code?: string;
        } | null;
        setError(
          (body?.code ? copy.errorsByCode[body.code] : undefined) ??
            copy.genericError,
        );
        return;
      }
      setConfirming(false);
      router.refresh();
    } catch {
      setError(copy.genericError);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="choose-bid">
      {confirming ? (
        <div
          className="own-offer-confirm choose-bid-confirm"
          role="group"
          aria-labelledby={titleId}
        >
          <h3 id={titleId} ref={confirmHeading} tabIndex={-1}>
            {copy.confirmTitle.replace("{provider}", providerName)}
          </h3>
          <p>{copy.confirmBody}</p>
          <div className="own-offer-actions">
            <button
              className="button button-primary"
              disabled={pending}
              onClick={() => void choose()}
              type="button"
            >
              {pending ? copy.choosing : copy.confirm}
            </button>
            <button
              className="button button-secondary"
              disabled={pending}
              onClick={closeConfirmation}
              type="button"
            >
              {copy.keep}
            </button>
          </div>
        </div>
      ) : (
        <button
          className="button button-primary"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
          ref={chooseButton}
          type="button"
        >
          {copy.choose}
        </button>
      )}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
