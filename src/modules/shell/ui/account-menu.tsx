"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { Locale } from "../../localization/config";
import { SignOutButton } from "../../identity/ui/sign-out-button";
import { DismissibleDetails } from "./dismissible-details";

type AccountMenuProps = Readonly<{
  displayName: string;
  locale: Locale;
  profileHref: string;
  profileLabel: string;
  signOutLabel: string;
  statusLabel: string;
  workingLabel: string;
  primary: Readonly<{ href: string; label: string }> | null;
}>;

function initialsFor(displayName: string, locale: Locale): string {
  return displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toLocaleUpperCase(locale);
}

function ProfileIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20v-1.5a6.5 6.5 0 0 1 13 0V20Z" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10" />
      <path d="M14.5 8.5 18 12l-3.5 3.5M9 12h9" />
    </svg>
  );
}

function PostIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m5.5 12.5 4 4 9-10" />
    </svg>
  );
}

function MenuIcon({ children }: Readonly<{ children: ReactNode }>) {
  return <span className="account-menu-icon">{children}</span>;
}

export function AccountMenu({
  displayName,
  locale,
  primary,
  profileHref,
  profileLabel,
  signOutLabel,
  statusLabel,
  workingLabel,
}: AccountMenuProps) {
  const pathname = usePathname() ?? "";
  const profileIsCurrent =
    pathname === profileHref || pathname.startsWith(`${profileHref}/`);
  const initials = initialsFor(displayName, locale);

  return (
    <DismissibleDetails className="account-menu">
      <summary aria-label={`${profileLabel}: ${displayName}`}>
        <span className="account-menu-trigger-avatar" aria-hidden="true">
          {initials}
        </span>
        <svg
          className="account-menu-chevron"
          aria-hidden="true"
          viewBox="0 0 16 16"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </summary>
      <div className="account-menu-panel">
        <div className="account-menu-identity">
          <span className="account-menu-avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="account-menu-identity-copy">
            <strong>{displayName}</strong>
            <span>{statusLabel}</span>
          </span>
        </div>
        <div className="account-menu-actions">
          {primary === null ? null : (
            <Link className="account-menu-primary" href={primary.href}>
              <MenuIcon>
                <PostIcon />
              </MenuIcon>
              <span>{primary.label}</span>
            </Link>
          )}
          <Link
            aria-current={profileIsCurrent ? "page" : undefined}
            className="account-menu-link"
            href={profileHref}
          >
            <MenuIcon>
              <ProfileIcon />
            </MenuIcon>
            <span>{profileLabel}</span>
            {profileIsCurrent ? (
              <span className="account-menu-current">
                <CheckIcon />
              </span>
            ) : null}
          </Link>
          <SignOutButton
            icon={
              <MenuIcon>
                <SignOutIcon />
              </MenuIcon>
            }
            label={signOutLabel}
            locale={locale}
            pendingLabel={workingLabel}
          />
        </div>
      </div>
    </DismissibleDetails>
  );
}
