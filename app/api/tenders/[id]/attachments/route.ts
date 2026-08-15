import { listTenderAttachments } from "../../../../../src/modules/tenders/application/list-tender-attachments";
import { uploadTenderAttachment } from "../../../../../src/modules/tenders/application/upload-tender-attachment";
import { createAttachmentHandlers } from "../../../../../src/modules/tenders/http/attachment-handlers";

const requireCustomer = async (headers: Headers) => {
  const { requireCapability } =
    await import("../../../../../src/modules/identity/application/require-capability");
  return requireCapability(headers, "CUSTOMER");
};

export const { POST, GET } = createAttachmentHandlers({
  requireCustomer,
  upload: uploadTenderAttachment,
  list: listTenderAttachments,
});
