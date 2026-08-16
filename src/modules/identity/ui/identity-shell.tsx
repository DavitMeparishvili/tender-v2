import type { ReactNode } from "react";

type IdentityShellProps = Readonly<{
  title: string;
  subtitle?: string;
  /**
   * `task` is the 460px identity column — one decision, no competition.
   * `form` is the 720px authoring column, wide enough for paired fields and a
   * map without stretching a form across the page. `wide` is the full 1200px
   * band for lists, detail pages and dashboards built out of cards.
   */
  width?: "task" | "form" | "wide";
  /** Rendered above the heading — a back link, status pill or breadcrumb. */
  eyebrow?: ReactNode;
  /** Rendered opposite the heading — the page's primary action. */
  actions?: ReactNode;
  progress?: Readonly<{
    current: 1 | 2 | 3;
    labels: readonly [string, string, string];
  }>;
  children: ReactNode;
}>;

/**
 * Every page inside the app shell renders through here, so the banded grey
 * page, the content measure and the single h1 stay consistent no matter which
 * module owns the route.
 */
export function IdentityShell({
  title,
  subtitle,
  width = "task",
  eyebrow,
  actions,
  progress,
  children,
}: IdentityShellProps) {
  return (
    <section
      aria-labelledby="page-heading"
      className="identity-page band band-grey"
    >
      <div className="band-inner">
        <div
          className={`identity-frame identity-frame-${width}`}
          data-identity-frame=""
        >
          {progress ? (
            <ol
              className="progress-rail"
              aria-label={`${progress.current} / 3`}
            >
              {progress.labels.map((label, index) => {
                const step = index + 1;
                return (
                  <li
                    className={step <= progress.current ? "is-complete" : ""}
                    key={label}
                    aria-current={
                      step === progress.current ? "step" : undefined
                    }
                  >
                    <span>{step}</span>
                    {label}
                  </li>
                );
              })}
            </ol>
          ) : null}
          {eyebrow}
          <div className="identity-heading">
            <div className="identity-heading-row">
              <h1 id="page-heading">{title}</h1>
              {actions ? (
                <div className="identity-heading-actions">{actions}</div>
              ) : null}
            </div>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}
