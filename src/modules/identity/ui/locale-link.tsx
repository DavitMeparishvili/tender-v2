"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "../../localization/config";

type LocaleLinkProps = Readonly<{
  currentLocale: Locale;
  targetLocale: Locale;
  label: string;
  dirtyWarning: string;
}>;

function localizedPath(pathname: string, locale: Locale): string {
  const segments = pathname.split("/");
  segments[1] = locale;
  return segments.join("/") || `/${locale}`;
}

export function LocaleLink({
  currentLocale,
  targetLocale,
  label,
  dirtyWarning,
}: LocaleLinkProps) {
  const pathname = usePathname() ?? `/${currentLocale}`;

  if (targetLocale === currentLocale) {
    return (
      <span className="locale-link is-current" aria-current="page">
        {label}
      </span>
    );
  }

  return (
    <Link
      className="locale-link"
      href={localizedPath(pathname, targetLocale)}
      hrefLang={targetLocale}
      lang={targetLocale}
      onClick={(event) => {
        const dirtyForm = document.querySelector('form[data-dirty="true"]');
        if (dirtyForm !== null && !window.confirm(dirtyWarning)) {
          event.preventDefault();
        }
      }}
    >
      {label}
    </Link>
  );
}
