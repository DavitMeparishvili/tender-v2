import { listTenderAttachments } from "./list-tender-attachments";
import {
  getAttachmentDownload,
  RENDERED_LINK_DOWNLOAD_URL_TTL_SECONDS,
} from "./get-attachment-download";
import type { TenderActor } from "./create-tender-draft";
export async function getAuthoringAttachments(id: string, actor: TenderActor) {
  const result = await listTenderAttachments(id, actor);
  if (!result.ok) return [];
  return Promise.all(
    result.value.map(async (file) => {
      const download = await getAttachmentDownload(
        id,
        file.id,
        actor,
        RENDERED_LINK_DOWNLOAD_URL_TTL_SECONDS,
      );
      return {
        id: file.id,
        originalFileName: file.originalFileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        url: download.ok ? download.value : null,
      };
    }),
  );
}
