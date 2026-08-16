import type { Clock, Result } from "../../shared";
import {
  toFullDetail,
  toPublicDetail,
  type FullTenderDetail,
  type PublicTenderDetail,
} from "../domain/masking";
import type { TenderRecord } from "../domain/tender";
import type { EntitlementCheck } from "../ports/entitlement-check";

export type ProviderTenderView =
  | Readonly<{ disclosure: "MASKED"; tender: PublicTenderDetail }>
  | Readonly<{ disclosure: "FULL"; tender: FullTenderDetail }>;

export interface GetSettleableTenderRepository {
  // Unlike `getPublished`, this accepts CLOSED and EXPIRED tenders and applies
  // no deadline predicate: the winner/loser views are exactly the case where
  // the deadline has already passed.
  getSettleable(id: string): Promise<Result<TenderRecord, "TENDER_NOT_FOUND">>;
}

export function createGetTenderForProvider(dependencies: {
  repository: GetSettleableTenderRepository;
  clock: Clock;
  isEntitled: EntitlementCheck;
}) {
  return async function getTenderForProvider(
    id: string,
    // `null` is a visitor with no provider identity to check entitlement
    // against — an unauthenticated browser or a signed-in non-provider — and
    // always resolves to the masked projection without touching the
    // entitlement port.
    actor: Readonly<{ id: string }> | null,
  ): Promise<Result<ProviderTenderView, "TENDER_NOT_FOUND">> {
    const found = await dependencies.repository.getSettleable(id);
    if (!found.ok) return found;

    const entitled =
      actor === null
        ? false
        : await dependencies.isEntitled(actor.id, id, dependencies.clock.now());
    return {
      ok: true,
      value: entitled
        ? { disclosure: "FULL", tender: toFullDetail(found.value) }
        : { disclosure: "MASKED", tender: toPublicDetail(found.value) },
    };
  };
}

export async function getTenderForProvider(
  id: string,
  actor: Readonly<{ id: string }> | null,
): Promise<Result<ProviderTenderView, "TENDER_NOT_FOUND">> {
  const [{ prismaTenderRepository }, { hasTenderEntitlement }] =
    await Promise.all([
      import("../infrastructure/prisma-tender-repository"),
      import("../../access/application/has-tender-entitlement"),
    ]);
  return createGetTenderForProvider({
    repository: prismaTenderRepository,
    clock: { now: () => new Date() },
    isEntitled: hasTenderEntitlement,
  })(id, actor);
}
