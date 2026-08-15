import { describe, expect, it } from "vitest";
import {
  createAttachmentDownloadHandler,
  createAttachmentHandlers,
} from "./attachment-handlers";

const authorizedActor = async () =>
  ({ ok: true, value: { id: "user-1" } }) as const;

function routeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function downloadRouteContext(id: string, attachmentId: string) {
  return { params: Promise.resolve({ id, attachmentId }) };
}

const STORED_OBJECT_KEY = "tenders/tender-1/super-secret-storage-address";

const storedAttachment = {
  id: "attachment-1",
  tenderId: "tender-1",
  objectKey: STORED_OBJECT_KEY,
  originalFileName: "plan.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1_234,
  createdAt: new Date("2026-08-15T00:00:00.000Z"),
};

function multipartUploadRequest(file: File | null): Request {
  const formData = new FormData();
  if (file !== null) formData.set("file", file);
  return new Request("http://localhost/api/tenders/tender-1/attachments", {
    method: "POST",
    body: formData,
  });
}

describe("attachment handlers", () => {
  it("uploads a real multipart file and never echoes the stored objectKey", async () => {
    let receivedUpload: unknown;
    const handlers = createAttachmentHandlers({
      requireCustomer: authorizedActor,
      upload: async (tenderId, upload) => {
        receivedUpload = { tenderId, upload };
        return { ok: true, value: storedAttachment };
      },
      list: async () => ({ ok: true, value: [] }),
    });

    const file = new File([new Uint8Array([1, 2, 3, 4])], "plan.pdf", {
      type: "application/pdf",
    });
    const response = await handlers.POST(
      multipartUploadRequest(file),
      routeContext("tender-1"),
    );

    expect(response.status).toBe(200);
    expect(receivedUpload).toMatchObject({
      tenderId: "tender-1",
      upload: { originalFileName: "plan.pdf" },
    });
    const uploadCall = receivedUpload as {
      upload: { body: Uint8Array };
    };
    expect(uploadCall.upload.body).toBeInstanceOf(Uint8Array);
    expect(Array.from(uploadCall.upload.body)).toEqual([1, 2, 3, 4]);

    const raw = await response.text();
    expect(raw).not.toContain("objectKey");
    expect(raw).not.toContain(STORED_OBJECT_KEY);
    expect(JSON.parse(raw)).toEqual({
      attachment: {
        id: "attachment-1",
        tenderId: "tender-1",
        originalFileName: "plan.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1_234,
        createdAt: "2026-08-15T00:00:00.000Z",
      },
    });
  });

  it("rejects an upload with no file entry without calling upload", async () => {
    let uploadCalled = false;
    const handlers = createAttachmentHandlers({
      requireCustomer: authorizedActor,
      upload: async () => {
        uploadCalled = true;
        return { ok: true, value: storedAttachment };
      },
      list: async () => ({ ok: true, value: [] }),
    });

    const response = await handlers.POST(
      multipartUploadRequest(null),
      routeContext("tender-1"),
    );

    expect(response.status).toBe(400);
    expect(uploadCalled).toBe(false);
  });

  it("rejects an upload where the file field is not a File", async () => {
    let uploadCalled = false;
    const handlers = createAttachmentHandlers({
      requireCustomer: authorizedActor,
      upload: async () => {
        uploadCalled = true;
        return { ok: true, value: storedAttachment };
      },
      list: async () => ({ ok: true, value: [] }),
    });

    const formData = new FormData();
    formData.set("file", "not-a-file");
    const request = new Request(
      "http://localhost/api/tenders/tender-1/attachments",
      { method: "POST", body: formData },
    );
    const response = await handlers.POST(request, routeContext("tender-1"));

    expect(response.status).toBe(400);
    expect(uploadCalled).toBe(false);
  });

  it("rejects an upload carrying no multipart body instead of failing open", async () => {
    let uploadCalled = false;
    const handlers = createAttachmentHandlers({
      requireCustomer: authorizedActor,
      upload: async () => {
        uploadCalled = true;
        return { ok: true, value: storedAttachment };
      },
      list: async () => ({ ok: true, value: [] }),
    });

    // A bodyless POST reaches `request.formData()`, which rejects. Left
    // unhandled that surfaces as a 500, reporting a server fault for what is
    // a malformed client request.
    const request = new Request(
      "http://localhost/api/tenders/tender-1/attachments",
      { method: "POST" },
    );
    const response = await handlers.POST(request, routeContext("tender-1"));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_INPUT" });
    expect(uploadCalled).toBe(false);
  });

  it("lists attachments without ever exposing objectKey in the serialized response", async () => {
    const handlers = createAttachmentHandlers({
      requireCustomer: authorizedActor,
      upload: async () => ({ ok: true, value: storedAttachment }),
      list: async () => ({ ok: true, value: [storedAttachment] }),
    });

    const response = await handlers.GET(
      new Request("http://localhost/api/tenders/tender-1/attachments"),
      routeContext("tender-1"),
    );

    expect(response.status).toBe(200);
    const raw = await response.text();
    expect(raw).not.toContain("objectKey");
    expect(raw).not.toContain(STORED_OBJECT_KEY);
    expect(JSON.parse(raw)).toEqual({
      attachments: [
        {
          id: "attachment-1",
          tenderId: "tender-1",
          originalFileName: "plan.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1_234,
          createdAt: "2026-08-15T00:00:00.000Z",
        },
      ],
    });
  });
});

describe("attachment download handler", () => {
  it("responds with the signed url on success", async () => {
    const handlers = createAttachmentDownloadHandler({
      requireCustomer: authorizedActor,
      getDownload: async () => ({
        ok: true,
        value: "https://storage.example.test/signed-download",
      }),
    });

    const response = await handlers.GET(
      new Request(
        "http://localhost/api/tenders/tender-1/attachments/attachment-1/download",
      ),
      downloadRouteContext("tender-1", "attachment-1"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "https://storage.example.test/signed-download",
    });
  });

  it("maps a not-found error to 404", async () => {
    const handlers = createAttachmentDownloadHandler({
      requireCustomer: authorizedActor,
      getDownload: async () => ({ ok: false, error: "NOT_FOUND" }),
    });

    const response = await handlers.GET(
      new Request(
        "http://localhost/api/tenders/tender-1/attachments/attachment-1/download",
      ),
      downloadRouteContext("tender-1", "attachment-1"),
    );

    expect(response.status).toBe(404);
  });
});
