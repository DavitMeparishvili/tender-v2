import { listEntitledAttachments } from "../../../../../../src/modules/tenders/application/list-tender-attachments";
import { createEntitledAttachmentHandlers } from "../../../../../../src/modules/tenders/http/discovery-handlers";

const requireProvider = async (headers: Headers) => {
  const { requireCapability } =
    await import("../../../../../../src/modules/identity/application/require-capability");
  return requireCapability(headers, "PROVIDER");
};

export const { GET } = createEntitledAttachmentHandlers({
  requireProvider,
  list: listEntitledAttachments,
});
