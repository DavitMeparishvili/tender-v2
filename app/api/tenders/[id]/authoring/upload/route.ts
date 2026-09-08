import { requireCapability } from "@/src/modules/identity/application/require-capability";
import { createPrepareTenderAttachmentUpload } from "@/src/modules/tenders/application/direct-upload-tender-attachment";
import { authoringAccess } from "@/src/modules/tenders/infrastructure/tender-authoring-repository";
import { prismaAttachmentRepository } from "@/src/modules/tenders/infrastructure/prisma-attachment-repository";
import { s3ObjectStorage } from "@/src/modules/tenders/infrastructure/s3-object-storage";
import { mapTenderError } from "@/src/modules/tenders/http/map-tender-error";
import { z } from "zod";
const schema = z
  .object({
    originalFileName: z.string(),
    sizeBytes: z.number(),
    contentType: z.string(),
  })
  .strict();
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireCapability(request.headers, "CUSTOMER");
  if (!access.ok) return mapTenderError(access.error);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return mapTenderError("INVALID_INPUT");
  const { id } = await context.params;
  const prepare = createPrepareTenderAttachmentUpload({
    repository: {
      countForOwnedDraft: authoringAccess,
      create: prismaAttachmentRepository.create.bind(
        prismaAttachmentRepository,
      ),
    },
    storage: s3ObjectStorage,
    ids: { next: () => crypto.randomUUID() },
  });
  const result = await prepare(id, parsed.data, access.value);
  return result.ok ? Response.json(result.value) : mapTenderError(result.error);
}
