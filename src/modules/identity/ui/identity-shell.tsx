import type { ReactNode } from "react";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import { LocaleLink } from "./locale-link";

type IdentityHeaderProps = Readonly<{
  locale: Locale;
  messages: Messages;
}>;

export function IdentityHeader({ locale, messages }: IdentityHeaderProps) {
  const otherLocale = locale === "ka" ? "en" : "ka";

  return (
    <header className="site-header">
      <a className="wordmark" href={`/${locale}`} aria-label="Tender home">
        {messages.common.brand}
      </a>
      <nav className="header-actions" aria-label={messages.common.language}>
        <details className="help-menu">
          <summary aria-label={messages.common.helpLabel}>
            {messages.common.help}
          </summary>
          <p>{messages.common.helpBody}</p>
        </details>
        <LocaleLink
          currentLocale={locale}
          targetLocale={otherLocale}
          label={
            otherLocale === "ka"
              ? messages.common.georgian
              : messages.common.english
          }
          dirtyWarning={messages.errors.dirtyLocale}
        />
      </nav>
    </header>
  );
}

type IdentityShellProps = Readonly<{
  title: string;
  subtitle?: string;
  progress?: Readonly<{
    current: 1 | 2 | 3;
    labels: readonly [string, string, string];
  }>;
  children: ReactNode;
}>;

export function IdentityShell({
  title,
  subtitle,
  progress,
  children,
}: IdentityShellProps) {
  return (
    <section className="identity-page" aria-labelledby="page-heading">
      <div className="identity-frame" data-identity-frame="">
        {progress ? (
          <ol className="progress-rail" aria-label={`${progress.current} / 3`}>
            {progress.labels.map((label, index) => {
              const step = index + 1;
              return (
                <li
                  className={step <= progress.current ? "is-complete" : ""}
                  key={label}
                  aria-current={step === progress.current ? "step" : undefined}
                >
                  <span>{step}</span>
                  {label}
                </li>
              );
            })}
          </ol>
        ) : null}
        <div className="identity-heading">
          <h1 id="page-heading">{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}
