import type { AgreementRepository } from "../infrastructure/prisma-agreement-gateway";
export const MAX_AGREEMENT_EXPIRIES_PER_SWEEP = 50;
export function createExpireDueAgreements(dependencies: {
  repository: AgreementRepository;
  now: () => Date;
  ids: { next(): string };
  selectionWindowDays: number;
}) {
  return async (limit = MAX_AGREEMENT_EXPIRIES_PER_SWEEP) => {
    const now = dependencies.now();
    const expired = [];
    for (const id of await dependencies.repository.listDueConfirmationIds(
      now,
      limit,
    )) {
      const result = await dependencies.repository.manage(
        id,
        { type: "EXPIRE", actorId: null },
        now,
        dependencies.ids,
        { selectionWindowDays: dependencies.selectionWindowDays },
      );
      if (result.ok) expired.push(result.value);
    }
    return expired;
  };
}
