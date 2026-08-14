import type { Clock, Result } from "../../shared";
import { canUseCapability, type AccessDenial } from "../domain/access-policy";
import type { Capability } from "../domain/capability";
import type { CurrentUser } from "./current-user";

export type CommercialCapability = Exclude<Capability, "ADMIN">;
export type AuthError = "UNAUTHENTICATED" | AccessDenial;

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
    required: CommercialCapability,
  ): Promise<Result<CurrentUser, AuthError>> {
    const user = await getCurrentUser(headers);
    if (user === null) {
      return { ok: false, error: "UNAUTHENTICATED" };
    }

    if (required !== "CUSTOMER" && required !== "PROVIDER") {
      return { ok: false, error: "CAPABILITY_MISSING" };
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
