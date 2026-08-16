import Link from "next/link";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import { LocaleLink } from "../../identity/ui/locale-link";
import { MobileTabBar } from "./mobile-tab-bar";
import { NavTabs } from "./nav-tabs";
import { buildShellNav, type ShellViewer } from "./nav-model";

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
  const otherLocale: Locale = locale === "ka" ? "en" : "ka";
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
          <LocaleLink
            currentLocale={locale}
            dirtyWarning={messages.errors.dirtyLocale}
            label={
              otherLocale === "ka"
                ? messages.common.georgian
                : messages.common.english
            }
            targetLocale={otherLocale}
          />
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
          <div className="header-actions">
            {nav.secondary === null ? null : (
              <Link className="header-link" href={nav.secondary.href}>
                {nav.secondary.label}
              </Link>
            )}
            {nav.primary === null ? null : (
              <Link className="pill pill-brand" href={nav.primary.href}>
                {nav.primary.label}
              </Link>
            )}
          </div>
        </div>
      </header>

      <MobileTabBar label={messages.nav.primary} tabs={nav.tabs} />
    </>
  );
}
