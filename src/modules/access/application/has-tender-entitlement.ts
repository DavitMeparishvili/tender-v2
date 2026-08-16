import { disclosureFor } from "../domain/disclosure-policy";
import type { ListEntitlementsRepository } from "./list-active-entitlements";

export function createHasTenderEntitlement(dependencies: {
  repository: ListEntitlementsRepository;
}) {
  return async function hasTenderEntitlement(
    providerId: string,
    tenderId: string,
    now: Date,
  ): Promise<boolean> {
    const entitlements =
      await dependencies.repository.listEntitlements(providerId);
    return (
      disclosureFor(entitlements, { providerId, tenderId }, now) === "FULL"
    );
  };
}

// The published cross-module query the `tenders` and `bidding` modules bind
// to their own `EntitlementCheck` port. It is the only entitlement surface
// other modules are allowed to consume.
export async function hasTenderEntitlement(
  providerId: string,
  tenderId: string,
  now: Date,
): Promise<boolean> {
  const { prismaEntitlementRepository } =
    await import("../infrastructure/prisma-entitlement-repository");
  return createHasTenderEntitlement({
    repository: prismaEntitlementRepository,
  })(providerId, tenderId, now);
}
