import type { Clock, Result } from "@/src/modules/shared";
import { toPublicDetail, type PublicTenderDetail } from "../domain/masking";
import type { TenderRecord } from "../domain/tender";

export interface GetPublishedTenderRepository {
  getPublished(
    id: string,
    now: Date,
  ): Promise<Result<TenderRecord, "TENDER_NOT_FOUND">>;
}

export function createGetPublishedTender(dependencies: {
  repository: GetPublishedTenderRepository;
  clock: Clock;
}) {
  return async function getPublishedTender(
    id: string,
  ): Promise<Result<PublicTenderDetail, "TENDER_NOT_FOUND">> {
    const result = await dependencies.repository.getPublished(
      id,
      dependencies.clock.now(),
    );
    return result.ok
      ? { ok: true, value: toPublicDetail(result.value) }
      : result;
  };
}

export async function getPublishedTender(
  id: string,
): Promise<Result<PublicTenderDetail, "TENDER_NOT_FOUND">> {
  const { prismaTenderRepository } =
    await import("../infrastructure/prisma-tender-repository");
  return createGetPublishedTender({
    repository: prismaTenderRepository,
    clock: { now: () => new Date() },
  })(id);
}
