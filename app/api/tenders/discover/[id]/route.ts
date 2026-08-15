import { getPublishedTender } from "../../../../../src/modules/tenders/application/get-published-tender";
import { createDiscoveredTenderHandlers } from "../../../../../src/modules/tenders/http/discovery-handlers";

const requireProvider = async (headers: Headers) => {
  const { requireCapability } =
    await import("../../../../../src/modules/identity/application/require-capability");
  return requireCapability(headers, "PROVIDER");
};

export const { GET } = createDiscoveredTenderHandlers({
  requireProvider,
  getDetail: getPublishedTender,
});
