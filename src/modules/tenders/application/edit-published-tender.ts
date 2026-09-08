import { z } from "zod";
import { workItemsSchema } from "./update-tender-draft";
import type { TenderActor } from "./create-tender-draft";
import type { Result } from "../../shared";

export const editPublishedTenderSchema = z
  .object({
    title: z.string().trim().min(5).max(160),
    fullDescription: z.string().trim().min(20).max(5000),
    workerNotes: z.string().trim().max(1000).nullable(),
    materialNotes: z.string().trim().max(1000).nullable(),
    equipmentNotes: z.string().trim().max(1000).nullable(),
    workItems: workItemsSchema,
    areaSquareMeters: z.number().finite().positive().max(1_000_000).nullable(),
  })
  .strict();
export type PublishedTenderEdit = z.infer<typeof editPublishedTenderSchema>;
export type PublishedEditError =
  "NOT_OWNER" | "TENDER_NOT_FOUND" | "EDIT_NOT_ALLOWED" | "INVALID_INPUT";
export async function editPublishedTender(
  id: string,
  input: unknown,
  actor: TenderActor,
): Promise<Result<null, PublishedEditError>> {
  const parsed = editPublishedTenderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  const { savePublishedTenderEdit } =
    await import("../infrastructure/save-published-tender-edit");
  return savePublishedTenderEdit(id, parsed.data, actor);
}
