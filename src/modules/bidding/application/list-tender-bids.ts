import type { Result } from "../../shared";
import type { Bid } from "../domain/bid";
import { rankBids } from "../domain/ranking";
import type { ProviderDirectory } from "../ports/provider-directory";
import type { BidActor } from "./submit-bid";

// What the client sees: every bid, ranked, with the provider's public display
// name. The client may compare but may not choose — no route in this module
// accepts a client-selected winner.
export type ClientBidView = Readonly<{
  id: string;
  providerId: string;
  providerDisplayName: string;
  amountMinorUnits: number;
  currency: Bid["currency"];
  status: Bid["status"];
  proposedStartDate: string | null;
  durationDays: number | null;
  includedCosts: string | null;
  exclusions: string | null;
  conditions: string;
  qualifyingSubmittedAt: string;
}>;

export interface ListTenderBidsRepository {
  listBids(tenderId: string): Promise<readonly Bid[]>;
}

export function createListTenderBids(dependencies: {
  repository: ListTenderBidsRepository;
  tenders: (
    id: string,
  ) => Promise<
    Result<
      Readonly<{ ownerId: string; currency: Bid["currency"]; deadline: Date }>,
      "TENDER_NOT_FOUND" | "NOT_OWNER"
    >
  >;
  directory: ProviderDirectory;
}) {
  return async function listTenderBids(
    tenderId: string,
    actor: BidActor,
  ): Promise<
    Result<readonly ClientBidView[], "TENDER_NOT_FOUND" | "NOT_OWNER">
  > {
    const tender = await dependencies.tenders(tenderId);
    if (!tender.ok) return tender;
    if (tender.value.ownerId !== actor.id) {
      return { ok: false, error: "NOT_OWNER" };
    }

    const bids = await dependencies.repository.listBids(tenderId);
    const terms = {
      currency: tender.value.currency,
      deadline: tender.value.deadline,
    };
    // Ranked order is the comparison order the client sees, so the ordering
    // the selector will use is visible rather than implied.
    const rankedIds = rankBids(bids, terms).map((bid) => bid.id);
    const ordered = [
      ...rankedIds
        .map((id) => bids.find((bid) => bid.id === id))
        .filter((bid): bid is Bid => bid !== undefined),
      ...bids.filter((bid) => !rankedIds.includes(bid.id)),
    ];

    const names = await dependencies.directory(
      ordered.map((bid) => bid.providerId),
    );

    return {
      ok: true,
      value: ordered.map((bid) => ({
        id: bid.id,
        providerId: bid.providerId,
        providerDisplayName: names.get(bid.providerId) ?? "",
        amountMinorUnits: bid.amountMinorUnits,
        currency: bid.currency,
        status: bid.status,
        proposedStartDate: bid.proposedStartDate?.toISOString() ?? null,
        durationDays: bid.durationDays,
        includedCosts: bid.includedCosts,
        exclusions: bid.exclusions,
        conditions: bid.conditions,
        qualifyingSubmittedAt: bid.qualifyingSubmittedAt.toISOString(),
      })),
    };
  };
}

export async function listTenderBids(
  tenderId: string,
  actor: BidActor,
): Promise<Result<readonly ClientBidView[], "TENDER_NOT_FOUND" | "NOT_OWNER">> {
  const [
    { prismaBidRepository },
    { getOwnedTender },
    { getProviderDisplayNames },
  ] = await Promise.all([
    import("../infrastructure/prisma-bid-repository"),
    import("../../tenders/application/get-owned-tender"),
    import("../../profiles/application/get-provider-display-names"),
  ]);
  // History remains readable after cancellation; the bidding context deliberately
  // excludes cancelled tenders because it gates new bidding operations.
  const owned = await getOwnedTender(tenderId, actor);
  if (!owned.ok) return owned;
  const { ownerId, currency, deadline } = owned.value;
  // A draft cancelled before publication cannot have received offers.
  if (currency === null || deadline === null) return { ok: true, value: [] };
  return createListTenderBids({
    repository: prismaBidRepository,
    tenders: async () => ({ ok: true, value: { ownerId, currency, deadline } }),
    directory: getProviderDisplayNames,
  })(tenderId, actor);
}
