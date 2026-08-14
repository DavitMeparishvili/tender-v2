import Link from "next/link";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import type { CurrentUser } from "../application/current-user";
import type { AccessDenial } from "../domain/access-policy";
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

  return (
    <IdentityShell
      title={title}
      subtitle={messages.workspace.welcome.replace("{name}", user.displayName)}
    >
      <div className="workspace-trust">
        <span aria-hidden="true" />
        {messages.common.verified}
      </div>
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
      <dl className="workspace-facts">
        <div>
          <dt>{messages.workspace.currentCapability}</dt>
          <dd>{capability}</dd>
        </div>
      </dl>
      <section className="workspace-empty">
        <h2>
          {isClient
            ? messages.workspace.clientEmptyTitle
            : messages.workspace.providerEmptyTitle}
        </h2>
        <p>
          {isClient
            ? messages.workspace.clientEmptyBody
            : messages.workspace.providerEmptyBody}
        </p>
      </section>
      <div className="workspace-actions">
        <Link
          className="button button-primary"
          href={"/" + locale + "/profile"}
        >
          {messages.workspace.editProfile}
        </Link>
        <Link
          className="button button-secondary"
          href={"/" + locale + "/forgot-password"}
        >
          {messages.common.security}
        </Link>
        <SignOutButton
          locale={locale}
          label={messages.common.signOut}
          pendingLabel={messages.common.working}
        />
      </div>
    </IdentityShell>
  );
}
