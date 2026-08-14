"use client";

import { useState } from "react";
import type { Locale } from "../../localization/config";

type SignOutButtonProps = Readonly<{
  locale: Locale;
  label: string;
  pendingLabel: string;
}>;

export function SignOutButton({
  locale,
  label,
  pendingLabel,
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
      {label}
      {pending ? " · " + pendingLabel : ""}
    </button>
  );
}
