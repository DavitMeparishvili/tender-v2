import type { Result } from "@/src/modules/shared";
import type { Capability } from "./capability";

export type AccountAccessState = Readonly<{
  emailVerified: boolean;
  onboardingComplete: boolean;
  disabledAt: Date | null;
  restrictedUntil: Date | null;
  capabilities: readonly Capability[];
}>;

export type AccessDenial =
  | "EMAIL_UNVERIFIED"
  | "ONBOARDING_INCOMPLETE"
  | "ACCOUNT_DISABLED"
  | "ACCOUNT_RESTRICTED"
  | "CAPABILITY_MISSING";

export function canUseCapability(
  state: AccountAccessState,
  required: Capability,
  now: Date,
): Result<void, AccessDenial> {
  if (state.disabledAt !== null) {
    return { ok: false, error: "ACCOUNT_DISABLED" };
  }

  if (state.restrictedUntil !== null && state.restrictedUntil > now) {
    return { ok: false, error: "ACCOUNT_RESTRICTED" };
  }

  if (!state.emailVerified) {
    return { ok: false, error: "EMAIL_UNVERIFIED" };
  }

  if (!state.onboardingComplete) {
    return { ok: false, error: "ONBOARDING_INCOMPLETE" };
  }

  if (!state.capabilities.includes(required)) {
    return { ok: false, error: "CAPABILITY_MISSING" };
  }

  return { ok: true, value: undefined };
}
