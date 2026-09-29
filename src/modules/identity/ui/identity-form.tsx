"use client";

export type FormIssue = Readonly<{
  field: string;
  message: string;
  label?: string | undefined;
}>;

type ErrorSummaryProps = Readonly<{
  issues: readonly FormIssue[];
  summaryOne: string;
  summaryMany: string;
  id?: string;
}>;

export function ErrorSummary({
  issues,
  summaryOne,
  summaryMany,
  id = "form-errors",
}: ErrorSummaryProps) {
  if (issues.length === 0) return null;

  const summary =
    issues.length === 1
      ? summaryOne
      : summaryMany.replace("{count}", String(issues.length));

  return (
    <div className="error-summary" id={id} role="alert" tabIndex={-1}>
      <p>{summary}</p>
      <ul>
        {issues.map((issue) => (
          <li key={`${issue.field}:${issue.message}`}>
            <a href={`#${issue.field}`}>
              {issue.label ? `${issue.label}: ` : null}
              {issue.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

type SubmitButtonProps = Readonly<{
  label: string;
  pendingLabel: string;
  isPending: boolean;
}>;

export function SubmitButton({
  label,
  pendingLabel,
  isPending,
}: SubmitButtonProps) {
  return (
    <button
      className="button button-primary submit-button"
      type="submit"
      disabled={isPending}
      aria-describedby={isPending ? "submit-pending" : undefined}
    >
      <span>{label}</span>
      {isPending ? (
        <span className="button-status" id="submit-pending" role="status">
          {pendingLabel}
        </span>
      ) : null}
    </button>
  );
}

export function focusErrorSummary(id = "form-errors") {
  document.getElementById(id)?.focus();
}
