import type { Result } from "@/src/modules/shared";
import type { TenderActor } from "./create-tender-draft";
import type { AttachmentRecord } from "./upload-tender-attachment";

export type ListAttachmentsError = "TENDER_NOT_FOUND" | "NOT_OWNER";

export interface ListTenderAttachmentsRepository {
  // Any status is accepted here: the owner must still see attachments on a
  // published or cancelled tender, unlike `countForOwnedDraft`, which is
  // draft-only because it guards uploads.
  listForOwnedTender(
    tenderId: string,
    actor: TenderActor,
  ): Promise<Result<readonly AttachmentRecord[], ListAttachmentsError>>;
}

export function createListTenderAttachments(
  repository: ListTenderAttachmentsRepository,
) {
  return (tenderId: string, actor: TenderActor) =>
    repository.listForOwnedTender(tenderId, actor);
}

export async function listTenderAttachments(
  tenderId: string,
  actor: TenderActor,
): Promise<Result<readonly AttachmentRecord[], ListAttachmentsError>> {
  const { prismaAttachmentRepository } =
    await import("../infrastructure/prisma-attachment-repository");
  return createListTenderAttachments(prismaAttachmentRepository)(
    tenderId,
    actor,
  );
}
