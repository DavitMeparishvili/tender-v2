import { publishTender } from "../../../../../src/modules/tenders/application/publish-tender";
import { createPublishHandlers } from "../../../../../src/modules/tenders/http/tender-handlers";

const requireCustomer = async (headers: Headers) => {
  const { requireCapability } =
    await import("../../../../../src/modules/identity/application/require-capability");
  return requireCapability(headers, "CUSTOMER");
};

export const { POST } = createPublishHandlers({
  requireCustomer,
  publish: publishTender,
});
