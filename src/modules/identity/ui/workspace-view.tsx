import Link from "next/link";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import type { CurrentUser } from "../application/current-user";
import type { AccessDenial } from "../domain/access-policy";
import { BrandIcon } from "../../shell/ui/brand-icon";
import { AuthState } from "./auth-state";
import { IdentityShell } from "./identity-shell";
import { SignOutButton } from "./sign-out-button";
import { WorkspaceSwitcher } from "./workspace-switcher";

type CommercialCapability = "CUSTOMER" | "PROVIDER";

export function WorkspaceDenied({
  error,
  locale,
  messages,
}: Readonly<{
  error: AccessDenial;
  locale: Locale;
  messages: Messages;
}>) {
  const body = {
    EMAIL_UNVERIFIED: messages.access.emailUnverified,
    ONBOARDING_INCOMPLETE: messages.access.onboardingIncomplete,
    ACCOUNT_DISABLED: messages.access.accountDisabled,
    ACCOUNT_RESTRICTED: messages.access.accountRestricted,
    CAPABILITY_MISSING: messages.access.capabilityMissing,
  }[error];
  const action =
    error === "EMAIL_UNVERIFIED"
      ? {
          href: "/" + locale + "/verify-email",
          label: messages.auth.verificationTitle,
        }
      : error === "ONBOARDING_INCOMPLETE"
        ? {
            href: "/" + locale + "/continue",
            label: messages.onboarding.complete,
          }
        : error === "CAPABILITY_MISSING"
          ? {
              href: "/" + locale + "/continue",
              label: messages.common.back,
            }
          : undefined;

  return (
    <IdentityShell title={messages.access.deniedTitle}>
      <AuthState
        state="access-denied"
        title={messages.access.deniedTitle}
        body={body}
        {...(action ? { action } : {})}
      />
    </IdentityShell>
  );
}

export function WorkspaceView({
  active,
  locale,
  messages,
  user,
}: Readonly<{
  active: CommercialCapability;
  locale: Locale;
  messages: Messages;
  user: CurrentUser;
}>) {
  const isClient = active === "CUSTOMER";
  const title = isClient
    ? messages.workspace.clientTitle
    : messages.workspace.providerTitle;
  const capability = isClient
    ? messages.workspace.customerCapability
    : messages.workspace.providerCapability;

  // Every destination here is also in the header nav; the dashboard states
  // what each one is for rather than being the only way to reach it.
  const tiles = [
    {
      href: isClient
        ? `/${locale}/client/tenders`
        : `/${locale}/provider/tenders`,
      icon: isClient ? "checklist" : "magnify",
      title: isClient ? messages.nav.myTenders : messages.nav.discover,
      body: isClient
        ? messages.workspace.clientEmptyBody
        : messages.workspace.providerEmptyBody,
    },
    {
      href: `/${locale}/${isClient ? "client" : "provider"}/agreements`,
      icon: "handshake",
      title: messages.workspace.agreements,
      body: messages.nav.agreementsBody,
    },
    {
      href: `/${locale}/notifications`,
      icon: "mail",
      title: messages.workspace.inbox,
      body: messages.nav.inboxBody,
    },
    {
      href: `/${locale}/profile`,
      icon: "profile",
      title: messages.workspace.editProfile,
      body: messages.profile.subtitle,
    },
  ] as const;

  return (
    <IdentityShell
      actions={
        <SignOutButton
          locale={locale}
          label={messages.common.signOut}
          pendingLabel={messages.common.working}
        />
      }
      eyebrow={
        <div className="workspace-trust">
          <span aria-hidden="true" />
          {messages.common.verified}
        </div>
      }
      title={title}
      subtitle={messages.workspace.welcome.replace("{name}", user.displayName)}
      width="wide"
    >
      <WorkspaceSwitcher
        locale={locale}
        capabilities={user.capabilities}
        active={active}
        labels={{
          switchWorkspace: messages.workspace.switchWorkspace,
          openClient: messages.workspace.openClient,
          openProvider: messages.workspace.openProvider,
        }}
      />

      <ul className="workspace-grid">
        {tiles.map((tile) => (
          <li key={tile.href}>
            <Link className="workspace-tile" href={tile.href}>
              <span className="icon-chip">
                <BrandIcon name={tile.icon} size={22} />
              </span>
              <span className="workspace-tile-title">{tile.title}</span>
              <span className="workspace-tile-body">{tile.body}</span>
            </Link>
          </li>
        ))}
      </ul>

      <dl className="workspace-facts">
        <div>
          <dt>{messages.workspace.currentCapability}</dt>
          <dd>{capability}</dd>
        </div>
      </dl>
      <p className="supporting-note">
        <Link href={`/${locale}/forgot-password`}>
          {messages.common.security}
        </Link>
      </p>
    </IdentityShell>
  );
}
