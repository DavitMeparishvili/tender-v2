import { searchPublishedTenders } from "../../../../src/modules/tenders/application/search-published-tenders";
import { createDiscoveryHandlers } from "../../../../src/modules/tenders/http/discovery-handlers";

const requireProvider = async (headers: Headers) => {
  const { requireCapability } =
    await import("../../../../src/modules/identity/application/require-capability");
  return requireCapability(headers, "PROVIDER");
};

export const { GET } = createDiscoveryHandlers({
  requireProvider,
  search: searchPublishedTenders,
});
