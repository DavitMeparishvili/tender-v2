import type { Result } from "../../shared";
import type { CurrentUser } from "../../identity/application/current-user";
import type { AccessDenial } from "../../identity/domain/access-policy";

type CustomerAccess = Result<CurrentUser, "UNAUTHENTICATED" | AccessDenial>;

export function resolveCustomerRouteAccess(access: CustomerAccess) {
  if (access.ok) {
    return { kind: "GRANTED", actor: access.value } as const;
  }
  if (access.error === "UNAUTHENTICATED") {
    return { kind: "LOGIN" } as const;
  }
  return { kind: "DENIED", error: access.error } as const;
}
