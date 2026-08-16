"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Messages } from "../../localization/get-messages";
import type { ModerationReviewView } from "../infrastructure/prisma-review-repository";

export function ReviewModerationList({
  reviews,
  copy,
}: Readonly<{
  reviews: readonly ModerationReviewView[];
  copy: Messages["moderation"];
}>) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (reviews.length === 0) return <p className="tender-empty">{copy.empty}</p>;
  async function redact(id: string, form: FormData) {
    setPending(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/reviews/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "REDACT",
          reason: String(form.get("reason") ?? ""),
        }),
      });
      if (!response.ok) {
        setError(copy.errors.generic);
        return;
      }
      router.refresh();
    } catch {
      setError(copy.errors.generic);
    } finally {
      setPending(null);
    }
  }
  return (
    <>
      {error ? <p role="alert">{error}</p> : null}
      <ul className="tender-list">
        {reviews.map((review) => (
          <li key={review.id}>
            <h2>{review.tenderTitle}</h2>
            <p>
              {copy.reviewer}: {review.reviewerDisplayName}
            </p>
            <p>
              {copy.reviewed}: {review.reviewedDisplayName}
            </p>
            <p>{review.comment}</p>
            {review.status === "REDACTED" ? (
              <p>{copy.redacted}</p>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void redact(review.id, new FormData(event.currentTarget));
                }}
              >
                <p>{copy.notice}</p>
                <label>
                  {copy.reason}
                  <textarea
                    name="reason"
                    required
                    minLength={10}
                    maxLength={500}
                  />
                </label>
                <button
                  className="button button-secondary"
                  type="submit"
                  disabled={pending === review.id}
                >
                  {copy.redact}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
