import { z } from "zod";
import { updateTenderDraftCommandSchema } from "./update-tender-draft";
import {
  syncTenderLocationCommandSchema,
  createSyncTenderLocation,
} from "./sync-tender-location";
import { getOwnedTender } from "./get-owned-tender";
import type { TenderActor } from "./create-tender-draft";
import type { TenderLocation } from "../domain/tender";
import { MAX_ATTACHMENT_BYTES } from "../domain/constraints";
import { sniffAttachmentMimeType } from "../domain/mime-sniff";

const draftShape = updateTenderDraftCommandSchema.shape;
export const authoringDetailsSchema = z
  .object({
    ...draftShape,
    fullDescription: draftShape.fullDescription.unwrap().nullable().optional(),
    shortDescription: draftShape.shortDescription
      .unwrap()
      .nullable()
      .optional(),
    scopeOfWork: draftShape.scopeOfWork.unwrap().nullable().optional(),
    budgetMinorUnits: draftShape.budgetMinorUnits
      .unwrap()
      .nullable()
      .optional(),
    deadline: draftShape.deadline.unwrap().nullable().optional(),
  })
  .strict()
  .refine(
    (value) =>
      updateTenderDraftCommandSchema.safeParse(
        Object.fromEntries(
          Object.entries(value).filter(([, field]) => field !== null),
        ),
      ).success,
  );
export type AuthoringDetails = z.output<typeof authoringDetailsSchema>;

export const authoringSchema = z
  .object({
    details: authoringDetailsSchema,
    location: syncTenderLocationCommandSchema.nullable().optional(),
    retainedAttachmentIds: z.array(z.string().uuid()).max(10),
    uploads: z
      .array(
        z
          .object({
            uploadId: z.string().uuid(),
            originalFileName: z.string().trim().min(1).max(255),
          })
          .strict(),
      )
      .max(10),
  })
  .strict()
  .refine((v) => v.retainedAttachmentIds.length + v.uploads.length <= 10)
  .refine(
    (v) =>
      new Set(v.retainedAttachmentIds).size ===
        v.retainedAttachmentIds.length &&
      new Set(v.uploads.map((f) => f.uploadId)).size === v.uploads.length,
  );

export async function saveTenderAuthoring(
  id: string,
  input: unknown,
  actor: TenderActor,
) {
  const parsed = authoringSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" } as const;
  const owned = await getOwnedTender(id, actor);
  if (!owned.ok) return owned;
  const { prismaGeorgianPlaceCatalog } =
    await import("../infrastructure/prisma-georgian-place-catalog");
  let location: TenderLocation | null | undefined =
    parsed.data.location === null ? null : undefined;
  if (parsed.data.location) {
    const resolve = createSyncTenderLocation({
      geocoder: prismaGeorgianPlaceCatalog,
      repository: {
        updateLocation: async (_id, value) => {
          location = value;
          return { ok: true, value: owned.value };
        },
      },
    });
    const resolved = await resolve(id, parsed.data.location, actor);
    if (!resolved.ok) return resolved;
  }
  const { s3ObjectStorage } =
    await import("../infrastructure/s3-object-storage");
  const files = [];
  for (const upload of parsed.data.uploads) {
    const objectKey = `tenders/${id}/${upload.uploadId}`;
    const stored = await s3ObjectStorage.inspectObject(objectKey);
    if (
      !stored ||
      stored.sizeBytes <= 0 ||
      stored.sizeBytes > MAX_ATTACHMENT_BYTES
    )
      return { ok: false, error: "FILE_TOO_LARGE" } as const;
    const mimeType = sniffAttachmentMimeType(stored.prefix);
    if (!mimeType || mimeType !== stored.contentType)
      return { ok: false, error: "UNSUPPORTED_FILE_TYPE" } as const;
    files.push({
      id: upload.uploadId,
      objectKey,
      originalFileName: upload.originalFileName,
      mimeType,
      sizeBytes: stored.sizeBytes,
    });
  }
  const { saveAuthoring } =
    await import("../infrastructure/tender-authoring-repository");
  return saveAuthoring(
    id,
    actor,
    parsed.data.details,
    location,
    parsed.data.retainedAttachmentIds,
    files,
  );
}
