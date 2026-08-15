import { getAttachmentDownload } from "../../../../../../../src/modules/tenders/application/get-attachment-download";
import { createAttachmentDownloadHandler } from "../../../../../../../src/modules/tenders/http/attachment-handlers";

const requireCustomer = async (headers: Headers) => {
  const { requireCapability } =
    await import("../../../../../../../src/modules/identity/application/require-capability");
  return requireCapability(headers, "CUSTOMER");
};

export const { GET } = createAttachmentDownloadHandler({
  requireCustomer,
  getDownload: getAttachmentDownload,
});
