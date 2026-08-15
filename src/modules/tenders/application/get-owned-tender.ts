import type { Result } from "../../shared";
import type { TenderDraft } from "../domain/tender";
import type { TenderActor } from "./create-tender-draft";

export interface GetOwnedTenderRepository {
  getOwned(
    id: string,
    actor: TenderActor,
  ): Promise<Result<TenderDraft, "TENDER_NOT_FOUND" | "NOT_OWNER">>;
}

export function createGetOwnedTender(repository: GetOwnedTenderRepository) {
  return (id: string, actor: TenderActor) => repository.getOwned(id, actor);
}

export async function getOwnedTender(
  id: string,
  actor: TenderActor,
): Promise<Result<TenderDraft, "TENDER_NOT_FOUND" | "NOT_OWNER">> {
  const { prismaTenderRepository } =
    await import("../infrastructure/prisma-tender-repository");
  return createGetOwnedTender(prismaTenderRepository)(id, actor);
}
