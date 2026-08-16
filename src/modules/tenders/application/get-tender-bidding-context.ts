import type { Result } from "../../shared";
import type { PublishedTenderStatus, TenderCurrency } from "../domain/tender";

// The narrow projection the `bidding` module is allowed to see. It is
// deliberately not `TenderRecord`: bidding needs the settlement currency, the
// deadline, the owner (to refuse a self-bid), and the status — nothing about
// the tender's location, attachments, or conditions.
export type TenderBiddingContext = Readonly<{
  id: string;
  ownerId: string;
  title: string;
  status: PublishedTenderStatus;
  currency: TenderCurrency;
  budgetMinorUnits: number;
  deadline: Date;
}>;

export interface TenderBiddingContextRepository {
  getBiddingContext(
    id: string,
  ): Promise<Result<TenderBiddingContext, "TENDER_NOT_FOUND">>;
}

export function createGetTenderBiddingContext(dependencies: {
  repository: TenderBiddingContextRepository;
}) {
  return async function getTenderBiddingContext(
    id: string,
  ): Promise<Result<TenderBiddingContext, "TENDER_NOT_FOUND">> {
    return dependencies.repository.getBiddingContext(id);
  };
}

// The published cross-module query. `bidding` binds its own
// `TenderContextLookup` port to this function and never touches the Tender
// table itself.
export async function getTenderBiddingContext(
  id: string,
): Promise<Result<TenderBiddingContext, "TENDER_NOT_FOUND">> {
  const { prismaTenderRepository } =
    await import("../infrastructure/prisma-tender-repository");
  return createGetTenderBiddingContext({
    repository: prismaTenderRepository,
  })(id);
}
