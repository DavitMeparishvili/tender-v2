import type { TenderDraft } from "../domain/tender";
import type { TenderActor } from "./create-tender-draft";

export type OwnedTenderQuery = Readonly<{
  search?: string;
  status?: TenderDraft["status"];
  sort?: "newest" | "oldest" | "deadline";
}>;
export function parseOwnedTenderQuery(
  params: Record<string, string | string[] | undefined>,
): OwnedTenderQuery {
  const statuses = [
    "DRAFT",
    "PUBLISHED",
    "CLOSED",
    "EXPIRED",
    "CANCELLED",
  ] as const;
  const status = statuses.find((value) => value === params.status);
  const search =
    typeof params.search === "string" ? params.search.trim().slice(0, 160) : "";
  const sort =
    params.sort === "oldest" || params.sort === "deadline"
      ? params.sort
      : "newest";
  return { ...(search ? { search } : {}), ...(status ? { status } : {}), sort };
}

export interface ListOwnedTendersRepository {
  listOwned(
    actor: TenderActor,
    query?: OwnedTenderQuery,
  ): Promise<readonly TenderDraft[]>;
}

export function createListOwnedTenders(repository: ListOwnedTendersRepository) {
  return (actor: TenderActor, query?: OwnedTenderQuery) =>
    repository.listOwned(actor, query);
}

export async function listOwnedTenders(
  actor: TenderActor,
  query?: OwnedTenderQuery,
): Promise<readonly TenderDraft[]> {
  const { prismaTenderRepository } =
    await import("../infrastructure/prisma-tender-repository");
  return createListOwnedTenders(prismaTenderRepository)(actor, query);
}

export async function countOwnedTenderStatuses(actor: TenderActor) {
  const { database } = await import("../../../infrastructure/db/client");
  const rows = await database.tender.groupBy({
    by: ["status"],
    where: { ownerId: actor.id },
    _count: true,
  });
  return Object.fromEntries(
    rows.map((row) => [row.status, row._count]),
  ) as Partial<Record<TenderDraft["status"], number>>;
}
