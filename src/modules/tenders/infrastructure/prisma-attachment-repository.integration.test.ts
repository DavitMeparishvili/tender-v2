import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
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
    { specialty: "CONSTRUCTION_REPAIR", title: "Repaint two rooms" },
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
    expect(denied.ok).toBe(false);
  });
});
