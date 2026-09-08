import { z } from "zod";
import type { Result } from "../../shared";
import { MAX_BUDGET_MINOR_UNITS } from "../domain/constraints";
import type { TenderDraft } from "../domain/tender";
import {
  isServiceForSpecialty,
  isTenderServiceCode,
  isTenderSpecialty,
  type TenderServiceCode,
  type TenderSpecialty,
} from "../domain/service-taxonomy";
import type { TenderActor } from "./create-tender-draft";

export const workItemsSchema = z
  .array(
    z
      .object({
        name: z.string().trim().min(1).max(160),
        quantity: z.number().finite().positive().max(1_000_000_000),
        unit: z.string().trim().min(1).max(20),
      })
      .strict(),
  )
  .max(100);

const tenderSpecialtySchema = z.custom<TenderSpecialty>(
  (value) => typeof value === "string" && isTenderSpecialty(value),
);
const tenderServiceCodeSchema = z.custom<TenderServiceCode>(
  (value) => typeof value === "string" && isTenderServiceCode(value),
);

export const updateTenderDraftCommandSchema = z
  .object({
    specialty: tenderSpecialtySchema.optional(),
    serviceCode: tenderServiceCodeSchema.optional(),
    title: z.string().trim().min(5).max(160).optional(),
    shortDescription: z.string().trim().min(10).max(240).optional(),
    fullDescription: z.string().trim().min(20).max(5_000).optional(),
    scopeOfWork: z.string().trim().min(10).max(2_000).optional(),
    workItems: workItemsSchema.optional(),
    areaSquareMeters: z
      .number()
      .finite()
      .positive()
      .max(1_000_000)
      .nullable()
      .optional(),
    // Bounded, not merely positive: `budgetMinorUnits` is written to an INT4
    // column, so an unbounded amount would reach Prisma and fail there as an
    // uncaught overflow — a 500 with a stack trace where the caller should
    // have received a 400.
    budgetMinorUnits: z
      .number()
      .int()
      .positive()
      .max(MAX_BUDGET_MINOR_UNITS)
      .optional(),
    currency: z.enum(["GEL", "USD"]).optional(),
    desiredStartDate: z.coerce.date().nullable().optional(),
    deadline: z.coerce.date().optional(),
    workerNotes: z.string().trim().max(1_000).nullable().optional(),
    equipmentNotes: z.string().trim().max(1_000).nullable().optional(),
    materialNotes: z.string().trim().max(1_000).nullable().optional(),
    conditions: z.string().trim().max(2_000).nullable().optional(),
  })
  .strict()
  .refine((command) => Object.keys(command).length > 0)
  .refine(
    (command) =>
      (command.specialty === undefined) === (command.serviceCode === undefined),
    { path: ["serviceCode"] },
  )
  .refine(
    (command) =>
      command.specialty === undefined ||
      command.serviceCode === undefined ||
      isServiceForSpecialty(command.serviceCode, command.specialty),
    { path: ["serviceCode"] },
  );

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
