import type { Result } from "@/src/modules/shared";
import type { ObjectStorage } from "../ports/object-storage";
import type { TenderActor } from "./create-tender-draft";

// The download API route hands its URL straight to a `fetch` in the caller's
// very next statement, so the signature only has to survive one round trip.
export const DOWNLOAD_URL_TTL_SECONDS = 60;

// A server-rendered owner page is different: it signs every attachment while
// rendering and embeds each URL in an `<a href>` the owner clicks whenever
// they get to it — routinely minutes of reading later, at which point a
// 60-second signature is already a MinIO "Request has expired" 403. Fifteen
// minutes comfortably outlives a read of one detail page while staying far
// shorter than any session, so a URL copied out of the page's markup stops
// working quickly.
export const RENDERED_LINK_DOWNLOAD_URL_TTL_SECONDS = 15 * 60;

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
    ttlSeconds: number = DOWNLOAD_URL_TTL_SECONDS,
  ): Promise<Result<string, "NOT_FOUND" | "NOT_OWNER">> {
    const attachment = await dependencies.repository.findOwnedAttachment(
      tenderId,
      attachmentId,
      actor,
    );
    if (!attachment.ok) return attachment;
    const url = await dependencies.storage.getSignedDownloadUrl(
      attachment.value.objectKey,
      ttlSeconds,
    );
    return { ok: true, value: url };
  };
}

export async function getAttachmentDownload(
  tenderId: string,
  attachmentId: string,
  actor: TenderActor,
  ttlSeconds: number = DOWNLOAD_URL_TTL_SECONDS,
): Promise<Result<string, "NOT_FOUND" | "NOT_OWNER">> {
  const [{ prismaAttachmentRepository }, { s3ObjectStorage }] =
    await Promise.all([
      import("../infrastructure/prisma-attachment-repository"),
      import("../infrastructure/s3-object-storage"),
    ]);
  return createGetAttachmentDownload({
    repository: prismaAttachmentRepository,
    storage: s3ObjectStorage,
  })(tenderId, attachmentId, actor, ttlSeconds);
}
