import Link from "next/link";

export type AuthStateKind =
  "pending" | "success" | "invalid" | "expired" | "reused" | "access-denied";

type StateAction = Readonly<{
  href: string;
  label: string;
}>;

type AuthStateProps = Readonly<{
  state: AuthStateKind;
  title: string;
  body: string;
  action?: StateAction;
  secondaryAction?: StateAction;
}>;

export function AuthState({
  state,
  title,
  body,
  action,
  secondaryAction,
}: AuthStateProps) {
  return (
    <div className="auth-state" data-auth-state={state}>
      <span className="state-mark" aria-hidden="true" />
      <div>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      {action || secondaryAction ? (
        <div className="state-actions">
          {action ? (
            <Link className="button button-primary" href={action.href}>
              {action.label}
            </Link>
          ) : null}
          {secondaryAction ? (
            <Link
              className="button button-secondary"
              href={secondaryAction.href}
            >
              {secondaryAction.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
