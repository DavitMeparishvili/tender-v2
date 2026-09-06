"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { Locale } from "../../localization/config";

type SignOutButtonProps = Readonly<{
  locale: Locale;
  label: string;
  pendingLabel: string;
  icon?: ReactNode;
}>;

export function SignOutButton({
  locale,
  label,
  pendingLabel,
  icon,
}: SignOutButtonProps) {
  const [pending, setPending] = useState(false);

  async function signOut() {
    if (pending) return;
    setPending(true);
    const { authClient } = await import("../infrastructure/auth-client");
    await authClient.signOut();
    window.location.assign("/" + locale + "/login");
  }

  return (
    <button
      className="button button-secondary"
      type="button"
      disabled={pending}
      onClick={signOut}
    >
      {icon}
      {label}
      {pending ? " · " + pendingLabel : ""}
    </button>
  );
}
