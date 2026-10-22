import type { Result } from "../../shared";
import type { Bid } from "../domain/bid";
import { orderVipFirst } from "../domain/display-order";
import { rankBids } from "../domain/ranking";
import { isChoosableBid } from "../domain/selection";
import type {
  ProviderDirectory,
  ProviderVipDirectory,
} from "../ports/provider-directory";
import type { BidActor } from "./submit-bid";

// What the client sees: every bid, with the provider's public display name.
// Offers from VIP providers come first, then the rest, each group lowest price
// first. The client compares them and chooses the contractor; the order is
// informational and never picks a winner by itself.
export type ClientBidView = Readonly<{
  id: string;
  providerId: string;
  providerDisplayName: string;
  // Display order only: whether the provider holds an active VIP membership.
  providerIsVip: boolean;
  amountMinorUnits: number;
  currency: Bid["currency"];
  status: Bid["status"];
  proposedStartDate: string | null;
  durationDays: number | null;
  includedCosts: string | null;
  exclusions: string | null;
  conditions: string;
  qualifyingSubmittedAt: string;
  // An active, eligible offer the client could choose (when the tender's
  // selection is open).
  choosable: boolean;
  // The lowest-priced choosable offer. Informational only.
  lowestPrice: boolean;
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
  vipDirectory: ProviderVipDirectory;
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
    // Lowest price first: the comparison order the client sees.
    const rankedIds = rankBids(bids, terms).map((bid) => bid.id);
    const lowestId = bids
      .filter((bid) => isChoosableBid(bid, terms))
      .sort(
        (left, right) =>
          rankedIds.indexOf(left.id) - rankedIds.indexOf(right.id),
      )[0]?.id;
    const ordered = [
      ...rankedIds
        .map((id) => bids.find((bid) => bid.id === id))
        .filter((bid): bid is Bid => bid !== undefined),
      ...bids.filter((bid) => !rankedIds.includes(bid.id)),
    ];

    const providerIds = ordered.map((bid) => bid.providerId);
    const [names, vipIds] = await Promise.all([
      dependencies.directory(providerIds),
      dependencies.vipDirectory(providerIds),
    ]);
    // Applied after `lowestId` is fixed above, so the lowest-price flag is
    // computed from price rank alone, whatever order the rows are shown in.
    // Withdrawn offers stay at the bottom whatever the provider's VIP status,
    // so the VIP partition only ever reorders live offers.
    const live = ordered.filter((bid) => bid.status !== "WITHDRAWN");
    const withdrawn = ordered.filter((bid) => bid.status === "WITHDRAWN");
    const displayed = [
      ...orderVipFirst(live, (bid) => vipIds.has(bid.providerId)),
      ...withdrawn,
    ];

    return {
      ok: true,
      value: displayed.map((bid) => ({
        id: bid.id,
        providerId: bid.providerId,
        providerDisplayName: names.get(bid.providerId) ?? "",
        providerIsVip: vipIds.has(bid.providerId),
        amountMinorUnits: bid.amountMinorUnits,
        currency: bid.currency,
        status: bid.status,
        proposedStartDate: bid.proposedStartDate?.toISOString() ?? null,
        durationDays: bid.durationDays,
        includedCosts: bid.includedCosts,
        exclusions: bid.exclusions,
        conditions: bid.conditions,
        qualifyingSubmittedAt: bid.qualifyingSubmittedAt.toISOString(),
        choosable: isChoosableBid(bid, terms),
        lowestPrice: bid.id === lowestId,
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
    { vipUserIds },
  ] = await Promise.all([
    import("../infrastructure/prisma-bid-repository"),
    import("../../tenders/application/get-owned-tender"),
    import("../../profiles/application/get-provider-display-names"),
    import("../../vip/application/vip-membership"),
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
    vipDirectory: vipUserIds,
  })(tenderId, actor);
}
