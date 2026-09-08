import Link from "next/link";
import { SUPPORTED_LOCALES, type Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import { LocaleLink } from "../../identity/ui/locale-link";
import { AccountMenu } from "./account-menu";
import { MobileTabBar } from "./mobile-tab-bar";
import { NavTabs } from "./nav-tabs";
import { buildShellNav, type ShellViewer } from "./nav-model";

function LocaleSwitcher({
  locale,
  messages,
  compact = false,
}: Readonly<{
  locale: Locale;
  messages: Messages;
  compact?: boolean;
}>) {
  const labels: Readonly<Record<Locale, string>> = {
    ka: messages.common.georgian,
    en: messages.common.english,
    ru: messages.common.russian,
  };

  return (
    <nav className="locale-switcher" aria-label={messages.common.language}>
      {SUPPORTED_LOCALES.map((targetLocale) => (
        <LocaleLink
          key={targetLocale}
          currentLocale={locale}
          dirtyWarning={messages.errors.dirtyLocale}
          label={labels[targetLocale]}
          {...(compact ? { shortLabel: targetLocale.toUpperCase() } : {})}
          targetLocale={targetLocale}
        />
      ))}
    </nav>
  );
}

/**
 * Every page renders inside this shell, so no surface is reachable only by
 * typing its URL. The strip carries the market statement and the locale
 * switch, the nav carries the destinations the viewer's capabilities allow,
 * and the same destinations reappear in the phone tab bar.
 */
export function SiteHeader({
  locale,
  messages,
  viewer,
}: Readonly<{
  locale: Locale;
  messages: Messages;
  viewer: ShellViewer | null;
}>) {
  const nav = buildShellNav(locale, messages, viewer);

  return (
    <>
      <div className="shell-strip">
        <div className="band-inner">
          <span>{messages.nav.tagline}</span>
          <span className="shell-strip-spacer" />
          <details className="help-menu">
            <summary aria-label={messages.common.helpLabel}>
              {messages.common.help}
            </summary>
            <p>{messages.common.helpBody}</p>
          </details>
          <LocaleSwitcher locale={locale} messages={messages} />
        </div>
      </div>

      <header className="site-header">
        <div className="band-inner">
          <Link
            aria-label={messages.common.brand}
            className="wordmark"
            href={`/${locale}`}
          >
            {messages.common.brand}
          </Link>
          <NavTabs items={nav.items} label={messages.nav.primary} />
          <span className="nav-spacer" />
          <details className="tender-mobile-locale">
            <summary aria-label={messages.common.language}>
              {locale.toUpperCase()}
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <LocaleSwitcher compact locale={locale} messages={messages} />
          </details>
          <div className="mobile-locale">
            <LocaleSwitcher compact locale={locale} messages={messages} />
          </div>
          <div className="header-actions">
            {viewer === null && nav.secondary !== null ? (
              <Link className="header-link" href={nav.secondary.href}>
                {nav.secondary.label}
              </Link>
            ) : null}
            {nav.primary === null ? null : (
              <Link className="pill pill-brand" href={nav.primary.href}>
                {nav.primary.label}
              </Link>
            )}
            {viewer !== null && nav.secondary !== null ? (
              <AccountMenu
                displayName={viewer.displayName}
                locale={locale}
                primary={nav.primary}
                profileHref={nav.secondary.href}
                profileLabel={messages.nav.profile}
                signOutLabel={messages.common.signOut}
                statusLabel={messages.common.verified}
                workingLabel={messages.common.working}
              />
            ) : null}
          </div>
        </div>
      </header>

      <MobileTabBar label={messages.nav.primary} tabs={nav.tabs} />
    </>
  );
}
