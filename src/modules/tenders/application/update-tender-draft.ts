import { z } from "zod";
import type { Result } from "../../shared";
import type { TenderDraft } from "../domain/tender";
import type { TenderActor } from "./create-tender-draft";

export const updateTenderDraftCommandSchema = z
  .object({
    title: z.string().trim().min(5).max(160).optional(),
    shortDescription: z.string().trim().min(10).max(240).optional(),
    fullDescription: z.string().trim().min(20).max(5_000).optional(),
    scopeOfWork: z.string().trim().min(10).max(2_000).optional(),
    budgetMinorUnits: z.number().int().positive().optional(),
    currency: z.enum(["GEL", "USD"]).optional(),
    desiredStartDate: z.coerce.date().optional(),
    deadline: z.coerce.date().optional(),
    workerNotes: z.string().trim().max(1_000).nullable().optional(),
    equipmentNotes: z.string().trim().max(1_000).nullable().optional(),
    materialNotes: z.string().trim().max(1_000).nullable().optional(),
    conditions: z.string().trim().max(2_000).nullable().optional(),
  })
  .strict()
  .refine((command) => Object.keys(command).length > 0);

export type UpdateTenderDraftCommand = z.output<
  typeof updateTenderDraftCommandSchema
>;
export type TenderMutationError =
  "TENDER_NOT_FOUND" | "NOT_OWNER" | "NOT_DRAFT";

export interface UpdateTenderDraftRepository {
  updateDraft(
    id: string,
    command: UpdateTenderDraftCommand,
    actor: TenderActor,
  ): Promise<Result<TenderDraft, TenderMutationError>>;
}

export function createUpdateTenderDraft(
  repository: UpdateTenderDraftRepository,
) {
  return async function updateTenderDraft(
    id: string,
    input: unknown,
    actor: TenderActor,
  ): Promise<Result<TenderDraft, TenderMutationError | "INVALID_INPUT">> {
    const parsed = updateTenderDraftCommandSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "INVALID_INPUT" };
    }
    return repository.updateDraft(id, parsed.data, actor);
  };
}

export async function updateTenderDraft(
  id: string,
  input: unknown,
  actor: TenderActor,
): Promise<Result<TenderDraft, TenderMutationError | "INVALID_INPUT">> {
  const { prismaTenderRepository } =
    await import("../infrastructure/prisma-tender-repository");
  return createUpdateTenderDraft(prismaTenderRepository)(id, input, actor);
}
