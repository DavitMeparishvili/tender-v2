import type { Entitlement } from "./entitlement";

export type DisclosureLevel = "MASKED" | "FULL";

export type DisclosureRequest = Readonly<{
  providerId: string;
  tenderId: string;
}>;

// One rule, one place. Every surface that could leak an exact address, the
// client's identity, attachments, or full conditions asks this function
// rather than re-deriving "is this provider allowed" from a payment row.
export function isActiveEntitlement(
  entitlement: Entitlement,
  request: DisclosureRequest,
  now: Date,
): boolean {
  if (entitlement.providerId !== request.providerId) return false;
  // A tender-scoped entitlement covers exactly that tender. A null tenderId
  // is a subscription and covers every tender.
  if (
    entitlement.tenderId !== null &&
    entitlement.tenderId !== request.tenderId
  ) {
    return false;
  }
  if (entitlement.grantedAt.getTime() > now.getTime()) return false;
  // `>=`, not `>`: the expiry instant is the first instant the entitlement no
  // longer holds, so a subscription cannot be used at its own expiry time.
  return (
    entitlement.expiresAt === null ||
    entitlement.expiresAt.getTime() > now.getTime()
  );
}

export function disclosureFor(
  entitlements: readonly Entitlement[],
  request: DisclosureRequest,
  now: Date,
): DisclosureLevel {
  return entitlements.some((entitlement) =>
    isActiveEntitlement(entitlement, request, now),
  )
    ? "FULL"
    : "MASKED";
}
