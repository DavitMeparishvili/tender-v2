import { z } from "zod";
import type { Clock, IdGenerator, Result } from "../../shared";
import type { TenderDraft } from "../domain/tender";
import {
  isServiceForSpecialty,
  isTenderServiceCode,
  isTenderSpecialty,
  type TenderServiceCode,
  type TenderSpecialty,
} from "../domain/service-taxonomy";

const tenderSpecialtySchema = z.custom<TenderSpecialty>(
  (value) => typeof value === "string" && isTenderSpecialty(value),
);
const tenderServiceCodeSchema = z.custom<TenderServiceCode>(
  (value) => typeof value === "string" && isTenderServiceCode(value),
);

export const createTenderDraftCommandSchema = z
  .object({
    specialty: tenderSpecialtySchema,
    serviceCode: tenderServiceCodeSchema,
    title: z.string().trim().min(5).max(160),
  })
  .strict()
  .refine(
    ({ specialty, serviceCode }) =>
      isServiceForSpecialty(serviceCode, specialty),
    { path: ["serviceCode"] },
  );

export type CreateTenderDraftCommand = z.output<
  typeof createTenderDraftCommandSchema
>;
export type TenderActor = Readonly<{ id: string }>;

export interface CreateTenderDraftRepository {
  createDraft(
    command: CreateTenderDraftCommand,
    actor: TenderActor,
    ids: Readonly<{ tenderId: string }>,
    now: Date,
  ): Promise<Result<TenderDraft, never>>;
}

export function createCreateTenderDraft(dependencies: {
  repository: CreateTenderDraftRepository;
  ids: IdGenerator;
  clock: Clock;
}) {
  return async function createTenderDraft(
    input: unknown,
    actor: TenderActor,
  ): Promise<Result<TenderDraft, "INVALID_INPUT">> {
    const parsed = createTenderDraftCommandSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "INVALID_INPUT" };
    }
    return dependencies.repository.createDraft(
      parsed.data,
      actor,
      { tenderId: dependencies.ids.next() },
      dependencies.clock.now(),
    );
  };
}

const systemIds: IdGenerator = { next: () => crypto.randomUUID() };
const systemClock: Clock = { now: () => new Date() };

export async function createTenderDraft(
  input: unknown,
  actor: TenderActor,
): Promise<Result<TenderDraft, "INVALID_INPUT">> {
  const { prismaTenderRepository } =
    await import("../infrastructure/prisma-tender-repository");
  return createCreateTenderDraft({
    repository: prismaTenderRepository,
    ids: systemIds,
    clock: systemClock,
  })(input, actor);
}
