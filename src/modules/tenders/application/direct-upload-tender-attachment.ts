import type { IdGenerator, Result } from "@/src/modules/shared";
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENTS_PER_TENDER,
  MAX_ATTACHMENT_BYTES,
  type AllowedAttachmentMimeType,
} from "../domain/constraints";
import { sniffAttachmentMimeType } from "../domain/mime-sniff";
import type { DirectUploadObjectStorage } from "../ports/object-storage";
import type { TenderActor } from "./create-tender-draft";
import type {
  AttachmentRecord,
  UploadAttachmentError,
  UploadAttachmentRepository,
} from "./upload-tender-attachment";

const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const SAFE_UPLOAD_ID = /^[A-Za-z0-9-]{1,64}$/;

export type DirectUploadError =
  UploadAttachmentError | "INVALID_INPUT" | "NOT_FOUND";

type PreparedUpload = Readonly<{
  uploadId: string;
  uploadUrl: string;
  contentType: AllowedAttachmentMimeType;
}>;

function isAllowedContentType(
  value: string,
): value is AllowedAttachmentMimeType {
  return ALLOWED_ATTACHMENT_MIME_TYPES.some((allowed) => allowed === value);
}

function objectKey(tenderId: string, uploadId: string): string {
  return `tenders/${tenderId}/${uploadId}`;
}

export function createPrepareTenderAttachmentUpload(dependencies: {
  repository: UploadAttachmentRepository;
  storage: DirectUploadObjectStorage;
  ids: IdGenerator;
}) {
  return async function prepareTenderAttachmentUpload(
    tenderId: string,
    input: Readonly<{
      originalFileName: string;
      sizeBytes: number;
      contentType: string;
    }>,
    actor: TenderActor,
  ): Promise<Result<PreparedUpload, DirectUploadError>> {
    const count = await dependencies.repository.countForOwnedDraft(
      tenderId,
      actor,
    );
    if (!count.ok) return count;
    if (count.value >= MAX_ATTACHMENTS_PER_TENDER) {
      return { ok: false, error: "TOO_MANY_ATTACHMENTS" };
    }
    if (
      input.originalFileName.trim() === "" ||
      input.originalFileName.length > 255 ||
      !Number.isSafeInteger(input.sizeBytes) ||
      input.sizeBytes <= 0
    ) {
      return { ok: false, error: "INVALID_INPUT" };
    }
    if (input.sizeBytes > MAX_ATTACHMENT_BYTES) {
      return { ok: false, error: "FILE_TOO_LARGE" };
    }
    if (!isAllowedContentType(input.contentType)) {
      return { ok: false, error: "UNSUPPORTED_FILE_TYPE" };
    }

    const uploadId = dependencies.ids.next();
    const uploadUrl = await dependencies.storage.getSignedUploadUrl(
      objectKey(tenderId, uploadId),
      input.contentType,
      UPLOAD_URL_TTL_SECONDS,
    );
    return {
      ok: true,
      value: { uploadId, uploadUrl, contentType: input.contentType },
    };
  };
}

export function createFinalizeTenderAttachmentUpload(dependencies: {
  repository: UploadAttachmentRepository;
  storage: DirectUploadObjectStorage;
  ids: IdGenerator;
}) {
  return async function finalizeTenderAttachmentUpload(
    tenderId: string,
    input: Readonly<{ uploadId: string; originalFileName: string }>,
    actor: TenderActor,
  ): Promise<Result<AttachmentRecord, DirectUploadError>> {
    const count = await dependencies.repository.countForOwnedDraft(
      tenderId,
      actor,
    );
    if (!count.ok) return count;
    if (count.value >= MAX_ATTACHMENTS_PER_TENDER) {
      return { ok: false, error: "TOO_MANY_ATTACHMENTS" };
    }
    if (
      !SAFE_UPLOAD_ID.test(input.uploadId) ||
      input.originalFileName.trim() === "" ||
      input.originalFileName.length > 255
    ) {
      return { ok: false, error: "INVALID_INPUT" };
    }

    const key = objectKey(tenderId, input.uploadId);
    const stored = await dependencies.storage.inspectObject(key);
    if (stored === null) return { ok: false, error: "NOT_FOUND" };
    if (stored.sizeBytes <= 0 || stored.sizeBytes > MAX_ATTACHMENT_BYTES) {
      await dependencies.storage.deleteObject(key);
      return { ok: false, error: "FILE_TOO_LARGE" };
    }

    const sniffed = sniffAttachmentMimeType(stored.prefix);
    if (
      sniffed === null ||
      !isAllowedContentType(stored.contentType ?? "") ||
      sniffed !== stored.contentType
    ) {
      await dependencies.storage.deleteObject(key);
      return { ok: false, error: "UNSUPPORTED_FILE_TYPE" };
    }

    const record = await dependencies.repository.create(
      tenderId,
      {
        objectKey: key,
        originalFileName: input.originalFileName,
        mimeType: sniffed,
        sizeBytes: stored.sizeBytes,
      },
      dependencies.ids.next(),
    );
    return { ok: true, value: record };
  };
}

const systemIds: IdGenerator = { next: () => crypto.randomUUID() };

export async function prepareTenderAttachmentUpload(
  tenderId: string,
  input: Readonly<{
    originalFileName: string;
    sizeBytes: number;
    contentType: string;
  }>,
  actor: TenderActor,
) {
  const [{ prismaAttachmentRepository }, { s3ObjectStorage }] =
    await Promise.all([
      import("../infrastructure/prisma-attachment-repository"),
      import("../infrastructure/s3-object-storage"),
    ]);
  return createPrepareTenderAttachmentUpload({
    repository: prismaAttachmentRepository,
    storage: s3ObjectStorage,
    ids: systemIds,
  })(tenderId, input, actor);
}

export async function finalizeTenderAttachmentUpload(
  tenderId: string,
  input: Readonly<{ uploadId: string; originalFileName: string }>,
  actor: TenderActor,
) {
  const [{ prismaAttachmentRepository }, { s3ObjectStorage }] =
    await Promise.all([
      import("../infrastructure/prisma-attachment-repository"),
      import("../infrastructure/s3-object-storage"),
    ]);
  return createFinalizeTenderAttachmentUpload({
    repository: prismaAttachmentRepository,
    storage: s3ObjectStorage,
    ids: systemIds,
  })(tenderId, input, actor);
}
