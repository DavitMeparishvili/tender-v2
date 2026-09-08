import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import {
  finalizeTenderAttachmentUpload,
  prepareTenderAttachmentUpload,
} from "../application/direct-upload-tender-attachment";
import { getAttachmentDownload } from "../application/get-attachment-download";
import { uploadTenderAttachment } from "../application/upload-tender-attachment";
import { MAX_ATTACHMENT_BYTES } from "../domain/constraints";
import { PrismaTenderRepository } from "./prisma-tender-repository";

const tenders = new PrismaTenderRepository();

async function seedOwnedDraft(): Promise<{
  ownerId: string;
  tenderId: string;
}> {
  const ownerId = randomUUID();
  await database.user.create({
    data: {
      id: ownerId,
      name: "Owner",
      email: `${ownerId}@tender.test`,
      emailVerified: true,
    },
  });
  const created = await tenders.createDraft(
    {
      specialty: "CONSTRUCTION_REPAIR",
      serviceCode: "GENERAL_CONSTRUCTION",
      title: "Repaint two rooms",
    },
    { id: ownerId },
    { tenderId: randomUUID() },
    new Date(),
  );
  if (!created.ok) throw new Error("seed failed");
  return { ownerId, tenderId: created.value.id };
}

afterAll(async () => {
  await database.$disconnect();
});

describe("tender attachment uploads", () => {
  it("uploads directly through a signed URL and finalizes the stored object", async () => {
    const { ownerId, tenderId } = await seedOwnedDraft();
    const actor = { id: ownerId };
    const body = new TextEncoder().encode("%PDF-1.7\n%%EOF");
    const prepared = await prepareTenderAttachmentUpload(
      tenderId,
      {
        originalFileName: "direct-plan.pdf",
        sizeBytes: body.byteLength,
        contentType: "application/pdf",
      },
      actor,
    );
    if (!prepared.ok) throw new Error(`prepare failed: ${prepared.error}`);

    const stored = await fetch(prepared.value.uploadUrl, {
      method: "PUT",
      headers: {
        "content-type": prepared.value.contentType,
        "if-none-match": "*",
      },
      body,
    });
    expect(stored.status).toBe(200);
    const replay = await fetch(prepared.value.uploadUrl, {
      method: "PUT",
      headers: {
        "content-type": prepared.value.contentType,
        "if-none-match": "*",
      },
      body,
    });
    expect(replay.status).toBe(412);

    const finalized = await finalizeTenderAttachmentUpload(
      tenderId,
      {
        uploadId: prepared.value.uploadId,
        originalFileName: "direct-plan.pdf",
      },
      actor,
    );
    expect(finalized.ok).toBe(true);
    if (!finalized.ok) return;
    expect(finalized.value).toMatchObject({
      originalFileName: "direct-plan.pdf",
      mimeType: "application/pdf",
      sizeBytes: body.byteLength,
    });
  });

  it("rejects a file whose bytes do not match any allowed signature", async () => {
    const { ownerId, tenderId } = await seedOwnedDraft();
    const result = await uploadTenderAttachment(
      tenderId,
      {
        originalFileName: "notes.txt",
        body: new TextEncoder().encode("plain text"),
      },
      { id: ownerId },
    );
    expect(result).toEqual({ ok: false, error: "UNSUPPORTED_FILE_TYPE" });
  });

  it("rejects the eleventh attachment for the same tender", async () => {
    const { ownerId, tenderId } = await seedOwnedDraft();
    const pdfBytes = new TextEncoder().encode("%PDF-1.7\n%%EOF");
    for (let index = 0; index < 10; index += 1) {
      const uploaded = await uploadTenderAttachment(
        tenderId,
        { originalFileName: `doc-${index}.pdf`, body: pdfBytes },
        { id: ownerId },
      );
      expect(uploaded.ok).toBe(true);
    }
    const eleventh = await uploadTenderAttachment(
      tenderId,
      { originalFileName: "doc-11.pdf", body: pdfBytes },
      { id: ownerId },
    );
    expect(eleventh).toEqual({ ok: false, error: "TOO_MANY_ATTACHMENTS" });
  });

  it("rejects a file larger than the per-attachment limit", async () => {
    const { ownerId, tenderId } = await seedOwnedDraft();
    const oversized = new Uint8Array(MAX_ATTACHMENT_BYTES + 1);
    oversized.set([0xff, 0xd8, 0xff, 0xe0]);
    const result = await uploadTenderAttachment(
      tenderId,
      { originalFileName: "huge.jpg", body: oversized },
      { id: ownerId },
    );
    expect(result).toEqual({ ok: false, error: "FILE_TOO_LARGE" });
  });

  it("refuses a download to anyone but the owning client", async () => {
    const { ownerId, tenderId } = await seedOwnedDraft();
    const { ownerId: strangerId } = await seedOwnedDraft();
    const uploaded = await uploadTenderAttachment(
      tenderId,
      {
        originalFileName: "plan.pdf",
        body: new TextEncoder().encode("%PDF-1.7\n%%EOF"),
      },
      { id: ownerId },
    );
    if (!uploaded.ok) throw new Error("upload failed");

    const denied = await getAttachmentDownload(tenderId, uploaded.value.id, {
      id: strangerId,
    });
    // Asserting the exact error, not just `ok === false`: a bare falsy check
    // also passes for NOT_FOUND, which would prove nothing about ownership.
    expect(denied).toEqual({ ok: false, error: "NOT_OWNER" });
  });

  it("issues the owning client a signed URL that downloads the stored bytes", async () => {
    const { ownerId, tenderId } = await seedOwnedDraft();
    const body = new TextEncoder().encode("%PDF-1.7\n%%EOF");
    const uploaded = await uploadTenderAttachment(
      tenderId,
      { originalFileName: "plan.pdf", body },
      { id: ownerId },
    );
    if (!uploaded.ok) throw new Error("upload failed");

    const download = await getAttachmentDownload(tenderId, uploaded.value.id, {
      id: ownerId,
    });
    expect(download.ok).toBe(true);
    if (!download.ok) return;

    const url = new URL(download.value);
    expect(url.pathname).toBe(
      `/${process.env.STORAGE_BUCKET}/${uploaded.value.objectKey}`,
    );
    expect(url.searchParams.get("X-Amz-Expires")).toBe("60");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);

    const response = await fetch(download.value);
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(body);
  });
});
