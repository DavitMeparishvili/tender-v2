import { describe, expect, it, vi } from "vitest";
import { MAX_ATTACHMENT_BYTES } from "../domain/constraints";
import type { DirectUploadObjectStorage } from "../ports/object-storage";
import {
  createFinalizeTenderAttachmentUpload,
  createPrepareTenderAttachmentUpload,
} from "./direct-upload-tender-attachment";
import type { UploadAttachmentRepository } from "./upload-tender-attachment";

const actor = { id: "user-1" };

function dependencies(input?: {
  inspected?: Awaited<ReturnType<DirectUploadObjectStorage["inspectObject"]>>;
}) {
  const create = vi.fn(async (tenderId, meta, id) => ({
    id,
    tenderId,
    ...meta,
    createdAt: new Date("2026-08-19T00:00:00.000Z"),
  }));
  const repository: UploadAttachmentRepository = {
    countForOwnedDraft: vi.fn(async () => ({ ok: true, value: 0 }) as const),
    create,
  };
  const deleteObject = vi.fn(async () => undefined);
  const storage: DirectUploadObjectStorage = {
    getSignedUploadUrl: vi.fn(async () => "https://storage.test/signed-put"),
    inspectObject: vi.fn(async () => input?.inspected ?? null),
    deleteObject,
  };
  const ids = { next: vi.fn(() => "upload-1") };
  return { repository, storage, ids, create, deleteObject };
}

describe("direct attachment uploads", () => {
  it("prepares a short-lived upload without exposing the object key", async () => {
    const deps = dependencies();
    const prepare = createPrepareTenderAttachmentUpload(deps);

    const result = await prepare(
      "tender-1",
      {
        originalFileName: "plan.pdf",
        sizeBytes: 1_024,
        contentType: "application/pdf",
      },
      actor,
    );

    expect(result).toEqual({
      ok: true,
      value: {
        uploadId: "upload-1",
        uploadUrl: "https://storage.test/signed-put",
        contentType: "application/pdf",
      },
    });
    expect(deps.storage.getSignedUploadUrl).toHaveBeenCalledWith(
      "tenders/tender-1/upload-1",
      "application/pdf",
      300,
    );
  });

  it("rejects oversized files before signing an upload", async () => {
    const deps = dependencies();
    const prepare = createPrepareTenderAttachmentUpload(deps);

    await expect(
      prepare(
        "tender-1",
        {
          originalFileName: "large.pdf",
          sizeBytes: MAX_ATTACHMENT_BYTES + 1,
          contentType: "application/pdf",
        },
        actor,
      ),
    ).resolves.toEqual({ ok: false, error: "FILE_TOO_LARGE" });
    expect(deps.storage.getSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("finalizes a stored object only after checking size and magic bytes", async () => {
    const deps = dependencies({
      inspected: {
        sizeBytes: 1_234,
        contentType: "application/pdf",
        prefix: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      },
    });
    const finalize = createFinalizeTenderAttachmentUpload(deps);

    const result = await finalize(
      "tender-1",
      { uploadId: "upload-1", originalFileName: "plan.pdf" },
      actor,
    );

    expect(result.ok).toBe(true);
    expect(deps.create).toHaveBeenCalledWith(
      "tender-1",
      {
        objectKey: "tenders/tender-1/upload-1",
        originalFileName: "plan.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1_234,
      },
      "upload-1",
    );
  });

  it("deletes an object whose declared type disagrees with its bytes", async () => {
    const deps = dependencies({
      inspected: {
        sizeBytes: 1_234,
        contentType: "image/png",
        prefix: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      },
    });
    const finalize = createFinalizeTenderAttachmentUpload(deps);

    await expect(
      finalize(
        "tender-1",
        { uploadId: "upload-1", originalFileName: "spoofed.png" },
        actor,
      ),
    ).resolves.toEqual({ ok: false, error: "UNSUPPORTED_FILE_TYPE" });
    expect(deps.deleteObject).toHaveBeenCalledWith("tenders/tender-1/upload-1");
    expect(deps.create).not.toHaveBeenCalled();
  });
});
