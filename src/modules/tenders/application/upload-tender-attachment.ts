import type { IdGenerator, Result } from "@/src/modules/shared";
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENTS_PER_TENDER,
  MAX_ATTACHMENT_BYTES,
} from "../domain/constraints";
import { sniffAttachmentMimeType } from "../domain/mime-sniff";
import type { ObjectStorage } from "../ports/object-storage";
import type { TenderActor } from "./create-tender-draft";

export type AttachmentRecord = Readonly<{
  id: string;
  tenderId: string;
  objectKey: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}>;

export type UploadAttachmentError =
  | "TENDER_NOT_FOUND"
  | "NOT_OWNER"
  | "NOT_DRAFT"
  | "UNSUPPORTED_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "TOO_MANY_ATTACHMENTS";

export interface UploadAttachmentRepository {
  countForOwnedDraft(
    tenderId: string,
    actor: TenderActor,
  ): Promise<Result<number, "TENDER_NOT_FOUND" | "NOT_OWNER" | "NOT_DRAFT">>;
  create(
    tenderId: string,
    meta: Readonly<{
      objectKey: string;
      originalFileName: string;
      mimeType: string;
      sizeBytes: number;
    }>,
    id: string,
  ): Promise<AttachmentRecord>;
}

export function createUploadTenderAttachment(dependencies: {
  repository: UploadAttachmentRepository;
  storage: ObjectStorage;
  ids: IdGenerator;
}) {
  return async function uploadTenderAttachment(
    tenderId: string,
    upload: Readonly<{ originalFileName: string; body: Uint8Array }>,
    actor: TenderActor,
  ): Promise<Result<AttachmentRecord, UploadAttachmentError>> {
    const count = await dependencies.repository.countForOwnedDraft(
      tenderId,
      actor,
    );
    if (!count.ok) return count;
    if (count.value >= MAX_ATTACHMENTS_PER_TENDER) {
      return { ok: false, error: "TOO_MANY_ATTACHMENTS" };
    }
    if (upload.body.byteLength > MAX_ATTACHMENT_BYTES) {
      return { ok: false, error: "FILE_TOO_LARGE" };
    }

    // The declared type and file name are attacker-controlled, so the stored
    // content type comes from the payload's own bytes.
    const sniffed = sniffAttachmentMimeType(upload.body);
    if (sniffed === null || !ALLOWED_ATTACHMENT_MIME_TYPES.includes(sniffed)) {
      return { ok: false, error: "UNSUPPORTED_FILE_TYPE" };
    }

    const objectKey = `tenders/${tenderId}/${dependencies.ids.next()}`;
    const stored = await dependencies.storage.putObject({
      objectKey,
      body: upload.body,
      contentType: sniffed,
    });
    if (!stored.ok) return { ok: false, error: "FILE_TOO_LARGE" };

    const record = await dependencies.repository.create(
      tenderId,
      {
        objectKey,
        originalFileName: upload.originalFileName,
        mimeType: sniffed,
        sizeBytes: stored.value.sizeBytes,
      },
      dependencies.ids.next(),
    );
    return { ok: true, value: record };
  };
}

const systemIds: IdGenerator = { next: () => crypto.randomUUID() };

export async function uploadTenderAttachment(
  tenderId: string,
  upload: Readonly<{ originalFileName: string; body: Uint8Array }>,
  actor: TenderActor,
): Promise<Result<AttachmentRecord, UploadAttachmentError>> {
  const [{ prismaAttachmentRepository }, { s3ObjectStorage }] =
    await Promise.all([
      import("../infrastructure/prisma-attachment-repository"),
      import("../infrastructure/s3-object-storage"),
    ]);
  return createUploadTenderAttachment({
    repository: prismaAttachmentRepository,
    storage: s3ObjectStorage,
    ids: systemIds,
  })(tenderId, upload, actor);
}
