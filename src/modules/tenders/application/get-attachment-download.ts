import type { Result } from "@/src/modules/shared";
import type { ObjectStorage } from "../ports/object-storage";
import type { TenderActor } from "./create-tender-draft";

const DOWNLOAD_URL_TTL_SECONDS = 60;

export interface GetAttachmentDownloadRepository {
  // There is no provider entitlement mechanism until Phase 3, so this must
  // require `ownerId === actor.id` unconditionally, with no provider path.
  findOwnedAttachment(
    tenderId: string,
    attachmentId: string,
    actor: TenderActor,
  ): Promise<
    Result<Readonly<{ objectKey: string }>, "NOT_FOUND" | "NOT_OWNER">
  >;
}

export function createGetAttachmentDownload(dependencies: {
  repository: GetAttachmentDownloadRepository;
  storage: ObjectStorage;
}) {
  return async function getAttachmentDownload(
    tenderId: string,
    attachmentId: string,
    actor: TenderActor,
  ): Promise<Result<string, "NOT_FOUND" | "NOT_OWNER">> {
    const attachment = await dependencies.repository.findOwnedAttachment(
      tenderId,
      attachmentId,
      actor,
    );
    if (!attachment.ok) return attachment;
    const url = await dependencies.storage.getSignedDownloadUrl(
      attachment.value.objectKey,
      DOWNLOAD_URL_TTL_SECONDS,
    );
    return { ok: true, value: url };
  };
}

export async function getAttachmentDownload(
  tenderId: string,
  attachmentId: string,
  actor: TenderActor,
): Promise<Result<string, "NOT_FOUND" | "NOT_OWNER">> {
  const [{ prismaAttachmentRepository }, { s3ObjectStorage }] =
    await Promise.all([
      import("../infrastructure/prisma-attachment-repository"),
      import("../infrastructure/s3-object-storage"),
    ]);
  return createGetAttachmentDownload({
    repository: prismaAttachmentRepository,
    storage: s3ObjectStorage,
  })(tenderId, attachmentId, actor);
}
