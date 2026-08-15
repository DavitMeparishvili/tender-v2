import type { TenderDraft } from "../domain/tender";
import type { TenderActor } from "./create-tender-draft";

export interface ListOwnedTendersRepository {
  listOwned(actor: TenderActor): Promise<readonly TenderDraft[]>;
}

export function createListOwnedTenders(repository: ListOwnedTendersRepository) {
  return (actor: TenderActor) => repository.listOwned(actor);
}

export async function listOwnedTenders(
  actor: TenderActor,
): Promise<readonly TenderDraft[]> {
  const { prismaTenderRepository } =
    await import("../infrastructure/prisma-tender-repository");
  return createListOwnedTenders(prismaTenderRepository)(actor);
}
