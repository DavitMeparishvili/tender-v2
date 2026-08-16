"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Messages } from "../../localization/get-messages";

const dimensions = [
  "quality",
  "deadline",
  "communication",
  "agreedPrice",
] as const;

export function ReviewForm({
  agreementId,
  copy,
}: Readonly<{ agreementId: string; copy: Messages["reviews"] }>) {
  const router = useRouter();
  const [scores, setScores] = useState<
    Record<(typeof dimensions)[number], number>
  >({ quality: 5, deadline: 5, communication: 5, agreedPrice: 5 });
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const overall = useMemo(
    () =>
      (scores.quality +
        scores.deadline +
        scores.communication +
        scores.agreedPrice) /
      4,
    [scores],
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);
    try {
      const response = await fetch(`/api/agreements/${agreementId}/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...scores, comment }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          code?: keyof typeof copy.errors;
        } | null;
        setError(
          body?.code && body.code in copy.errors
            ? copy.errors[body.code]
            : copy.errors.generic,
        );
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch {
      setError(copy.errors.generic);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="review-form" onSubmit={(event) => void submit(event)}>
      {dimensions.map((dimension) => (
        <label key={dimension}>
          {copy[dimension]}
          <select
            value={scores[dimension]}
            onChange={(event) =>
              setScores((current) => ({
                ...current,
                [dimension]: Number(event.target.value),
              }))
            }
          >
            {[1, 2, 3, 4, 5].map((score) => (
              <option key={score} value={score}>
                {score}
              </option>
            ))}
          </select>
        </label>
      ))}
      <p>
        {copy.overall}: {overall.toFixed(2)}
      </p>
      <label>
        {copy.comment}
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          minLength={30}
          maxLength={1000}
          required
          aria-describedby="review-comment-hint"
        />
      </label>
      <p id="review-comment-hint">
        {copy.commentHint}{" "}
        {copy.remaining.replace(
          "{count}",
          String(1000 - Array.from(comment).length),
        )}
      </p>
      <p>{copy.publicationNotice}</p>
      <button
        className="button button-primary"
        type="submit"
        disabled={pending}
      >
        {pending ? copy.publishing : copy.publish}
      </button>
      {success ? <p role="status">{copy.published}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
