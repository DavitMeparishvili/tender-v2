import { finalizeTenderAttachmentUpload } from "../../../../../../src/modules/tenders/application/direct-upload-tender-attachment";
import { createFinalizeDirectUploadHandler } from "../../../../../../src/modules/tenders/http/direct-upload-handlers";

const requireCustomer = async (headers: Headers) => {
  const { requireCapability } =
    await import("../../../../../../src/modules/identity/application/require-capability");
  return requireCapability(headers, "CUSTOMER");
};

export const POST = createFinalizeDirectUploadHandler({
  requireCustomer,
  finalize: finalizeTenderAttachmentUpload,
});
