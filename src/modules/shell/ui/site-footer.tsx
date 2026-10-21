import Link from "next/link";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";

export function SiteFooter({
  locale,
  messages,
}: Readonly<{ locale: Locale; messages: Messages }>) {
  const at = (path: string) => `/${locale}${path}`;

  const columns = [
    {
      heading: messages.nav.clientsColumn,
      links: [
        { href: at("/client/tenders/new"), label: messages.nav.postTender },
        { href: at("/#how-it-works"), label: messages.nav.howSelectionWorks },
        { href: at("/client/agreements"), label: messages.nav.agreements },
        { href: at("/#reviews"), label: messages.nav.reviews },
      ],
    },
    {
      heading: messages.nav.providersColumn,
      links: [
        { href: at("/provider/tenders"), label: messages.nav.discover },
        { href: at("/#access"), label: messages.nav.accessPlans },
        { href: at("/register/provider"), label: messages.nav.verification },
        { href: at("/#categories"), label: messages.nav.categories },
      ],
    },
    {
      heading: messages.nav.companyColumn,
      links: [
        { href: at("/#trust"), label: messages.nav.about },
        { href: at("/#trust"), label: messages.nav.trustAndSafety },
        { href: at("/#how-it-works"), label: messages.nav.support },
        { href: at("/#trust"), label: messages.nav.terms },
      ],
    },
  ];

  return (
    <footer className="shell-footer">
      <div className="band-inner">
        <div className="tender-compact-footer">
          <details>
            <summary>{messages.common.help}</summary>
            <p>{messages.common.helpBody}</p>
          </details>
          <span aria-hidden="true">·</span>
          <Link href={at("/#trust")}>{messages.nav.terms}</Link>
        </div>
        <div className="footer-grid">
          <div>
            <Link
              aria-label={messages.common.brand}
              className="footer-word"
              href={at("")}
            >
              <span className="wordmark-text" lang="en">
                <span className="wordmark-name">Tender</span>
                <span className="wordmark-sub">market</span>
              </span>
            </Link>
            <p className="footer-blurb">{messages.nav.footerBlurb}</p>
          </div>
          {columns.map((column) => (
            <div className="footer-col" key={column.heading}>
              <h2 className="footer-head">{column.heading}</h2>
              <ul>
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.label}`}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="footer-legal">{messages.nav.legal}</p>
      </div>
    </footer>
  );
}
