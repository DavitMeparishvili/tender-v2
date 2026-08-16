import type { Clock } from "../../shared";
import { isActiveEntitlement } from "../domain/disclosure-policy";
import type { Entitlement } from "../domain/entitlement";
import type { AccessActor } from "./start-access-checkout";

export interface ListEntitlementsRepository {
  listEntitlements(providerId: string): Promise<readonly Entitlement[]>;
}

export function createListActiveEntitlements(dependencies: {
  repository: ListEntitlementsRepository;
  clock: Clock;
}) {
  return async function listActiveEntitlements(
    actor: AccessActor,
  ): Promise<readonly Entitlement[]> {
    const now = dependencies.clock.now();
    const all = await dependencies.repository.listEntitlements(actor.id);
    // `isActiveEntitlement` needs a tender to compare against; a
    // tender-scoped entitlement is always "active for its own tender", so
    // asking about its own tenderId is the correct question here.
    return all.filter((entitlement) =>
      isActiveEntitlement(
        entitlement,
        {
          providerId: actor.id,
          tenderId: entitlement.tenderId ?? "",
        },
        now,
      ),
    );
  };
}

export async function listActiveEntitlements(
  actor: AccessActor,
): Promise<readonly Entitlement[]> {
  const { prismaEntitlementRepository } =
    await import("../infrastructure/prisma-entitlement-repository");
  return createListActiveEntitlements({
    repository: prismaEntitlementRepository,
    clock: { now: () => new Date() },
  })(actor);
}
