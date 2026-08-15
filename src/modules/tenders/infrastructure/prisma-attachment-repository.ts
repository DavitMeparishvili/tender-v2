import type { TenderAttachment } from "../../../generated/prisma/client";
import { database } from "../../../infrastructure/db/client";
import type { Result } from "../../shared";
import type { TenderActor } from "../application/create-tender-draft";
import type { GetAttachmentDownloadRepository } from "../application/get-attachment-download";
import type {
  ListAttachmentsError,
  ListTenderAttachmentsRepository,
} from "../application/list-tender-attachments";
import type {
  AttachmentRecord,
  UploadAttachmentRepository,
} from "../application/upload-tender-attachment";

export interface AttachmentRepository
  extends
    UploadAttachmentRepository,
    ListTenderAttachmentsRepository,
    GetAttachmentDownloadRepository {}

function toAttachmentRecord(row: TenderAttachment): AttachmentRecord {
  return {
    id: row.id,
    tenderId: row.tenderId,
    objectKey: row.objectKey,
    originalFileName: row.originalFileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt,
  };
}

export class PrismaAttachmentRepository implements AttachmentRepository {
  async countForOwnedDraft(
    tenderId: string,
    actor: TenderActor,
  ): Promise<Result<number, "TENDER_NOT_FOUND" | "NOT_OWNER" | "NOT_DRAFT">> {
    // Same shape as `PrismaTenderRepository.updateDraft`: one conditional
    // query carries the whole guard, and the re-read only runs to explain a
    // miss as absent, foreign, or no longer a draft.
    const ownedDraft = await database.tender.findFirst({
      where: { id: tenderId, ownerId: actor.id, status: "DRAFT" },
      select: { id: true },
    });

    if (ownedDraft === null) {
      const existing = await database.tender.findUnique({
        where: { id: tenderId },
        select: { ownerId: true },
      });
      if (existing === null) {
        return { ok: false, error: "TENDER_NOT_FOUND" };
      }
      if (existing.ownerId !== actor.id) {
        return { ok: false, error: "NOT_OWNER" };
      }
      return { ok: false, error: "NOT_DRAFT" };
    }

    const count = await database.tenderAttachment.count({
      where: { tenderId },
    });
    return { ok: true, value: count };
  }

  async create(
    tenderId: string,
    meta: Readonly<{
      objectKey: string;
      originalFileName: string;
      mimeType: string;
      sizeBytes: number;
    }>,
    id: string,
  ): Promise<AttachmentRecord> {
    const created = await database.tenderAttachment.create({
      data: {
        id,
        tenderId,
        objectKey: meta.objectKey,
        originalFileName: meta.originalFileName,
        mimeType: meta.mimeType,
        sizeBytes: meta.sizeBytes,
      },
    });
    return toAttachmentRecord(created);
  }

  async listForOwnedTender(
    tenderId: string,
    actor: TenderActor,
  ): Promise<Result<readonly AttachmentRecord[], ListAttachmentsError>> {
    // Deliberately no draft guard: the owner must still see the attachments on
    // a published or cancelled tender.
    const tender = await database.tender.findUnique({
      where: { id: tenderId },
      select: { ownerId: true },
    });
    if (tender === null) {
      return { ok: false, error: "TENDER_NOT_FOUND" };
    }
    if (tender.ownerId !== actor.id) {
      return { ok: false, error: "NOT_OWNER" };
    }

    const rows = await database.tenderAttachment.findMany({
      where: { tenderId },
      orderBy: { createdAt: "asc" },
    });
    return { ok: true, value: rows.map(toAttachmentRecord) };
  }

  async findOwnedAttachment(
    tenderId: string,
    attachmentId: string,
    actor: TenderActor,
  ): Promise<
    Result<Readonly<{ objectKey: string }>, "NOT_FOUND" | "NOT_OWNER">
  > {
    // Ownership is read through the parent tender rather than trusted from the
    // caller, so an attachment id guessed by a stranger cannot yield a signed
    // URL. There is no provider entitlement mechanism until Phase 3, so the
    // owning client is the only reader.
    const row = await database.tenderAttachment.findFirst({
      where: { id: attachmentId, tenderId },
      select: { objectKey: true, tender: { select: { ownerId: true } } },
    });
    if (row === null) {
      return { ok: false, error: "NOT_FOUND" };
    }
    if (row.tender.ownerId !== actor.id) {
      return { ok: false, error: "NOT_OWNER" };
    }
    return { ok: true, value: { objectKey: row.objectKey } };
  }
}

export const prismaAttachmentRepository = new PrismaAttachmentRepository();
