import { describe, expect, it, vi } from "vitest";
import {
  DOWNLOAD_URL_TTL_SECONDS,
  RENDERED_LINK_DOWNLOAD_URL_TTL_SECONDS,
  createGetAttachmentDownload,
} from "./get-attachment-download";

const actor = { id: "owner-1" };

function harness() {
  const getSignedDownloadUrl = vi.fn(async () => "https://storage.test/signed");
  const getAttachmentDownload = createGetAttachmentDownload({
    repository: {
      findOwnedAttachment: async () => ({
        ok: true as const,
        value: { objectKey: "tenders/tender-1/attachment-1" },
      }),
      findPublishedAttachment: async () => ({
        ok: true as const,
        value: { objectKey: "tenders/tender-1/attachment-1" },
      }),
    },
    storage: { getSignedDownloadUrl, putObject: vi.fn() },
  });
  return { getAttachmentDownload, getSignedDownloadUrl };
}

describe("createGetAttachmentDownload", () => {
  it("signs for the short API lifetime by default", async () => {
    const { getAttachmentDownload, getSignedDownloadUrl } = harness();

    await getAttachmentDownload("tender-1", "attachment-1", actor);

    expect(getSignedDownloadUrl).toHaveBeenCalledWith(
      "tenders/tender-1/attachment-1",
      DOWNLOAD_URL_TTL_SECONDS,
    );
  });

  // A server-rendered `<a href>` is clicked whenever the reader gets to it,
  // which is routinely minutes after the page was rendered — the API's
  // 60-second signature would already have expired into a MinIO 403.
  it("signs a server-rendered link for long enough to outlive a read", async () => {
    const { getAttachmentDownload, getSignedDownloadUrl } = harness();

    await getAttachmentDownload(
      "tender-1",
      "attachment-1",
      actor,
      RENDERED_LINK_DOWNLOAD_URL_TTL_SECONDS,
    );

    expect(getSignedDownloadUrl).toHaveBeenCalledWith(
      "tenders/tender-1/attachment-1",
      RENDERED_LINK_DOWNLOAD_URL_TTL_SECONDS,
    );
    expect(RENDERED_LINK_DOWNLOAD_URL_TTL_SECONDS).toBeGreaterThan(
      DOWNLOAD_URL_TTL_SECONDS,
    );
  });
});
