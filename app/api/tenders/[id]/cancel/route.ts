import { cancelTender } from "../../../../../src/modules/tenders/application/cancel-tender";
import { createCancelHandlers } from "../../../../../src/modules/tenders/http/tender-handlers";

const requireCustomer = async (headers: Headers) => {
  const { requireCapability } =
    await import("../../../../../src/modules/identity/application/require-capability");
  return requireCapability(headers, "CUSTOMER");
};

export const { POST } = createCancelHandlers({
  requireCustomer,
  cancel: cancelTender,
});
