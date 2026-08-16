import type { Clock, Result } from "../../shared";
import { canUseCapability, type AccessDenial } from "../domain/access-policy";
import type { Capability } from "../domain/capability";
import type { CurrentUser } from "./current-user";

export type AuthError = "UNAUTHENTICATED" | AccessDenial;
export type CommercialCapability = Capability;

type CurrentUserResolver = (headers: Headers) => Promise<CurrentUser | null>;

type RequireCapabilityDependencies = Readonly<{
  getCurrentUser: CurrentUserResolver;
  clock: Clock;
}>;

export function createRequireCapability({
  getCurrentUser,
  clock,
}: RequireCapabilityDependencies) {
  return async function requireCapability(
    headers: Headers,
    required: Capability,
  ): Promise<Result<CurrentUser, AuthError>> {
    const user = await getCurrentUser(headers);
    if (user === null) {
      return { ok: false, error: "UNAUTHENTICATED" };
    }

    const access = canUseCapability(user, required, clock.now());
    if (!access.ok) {
      return access;
    }

    return { ok: true, value: user };
  };
}

const systemClock: Clock = { now: () => new Date() };
const resolveCurrentUser: CurrentUserResolver = async (headers) => {
  const { getCurrentUser } = await import("./current-user");
  return getCurrentUser(headers);
};

export const requireCapability = createRequireCapability({
  getCurrentUser: resolveCurrentUser,
  clock: systemClock,
});

export async function requireAnyCommercialCapability(headers: Headers) {
  const user = await resolveCurrentUser(headers);
  if (user === null)
    return { ok: false as const, error: "UNAUTHENTICATED" as const };
  const capability = (["CUSTOMER", "PROVIDER"] as const).find((code) =>
    user.capabilities.includes(code),
  );
  if (capability === undefined)
    return { ok: false as const, error: "CAPABILITY_MISSING" as const };
  const access = canUseCapability(user, capability, systemClock.now());
  return access.ok ? { ok: true as const, value: user } : access;
}
