import { getBidSummary } from "../../../../../../src/modules/bidding/application/get-bid-summary";
import { createBidSummaryHandlers } from "../../../../../../src/modules/bidding/http/bid-handlers";

const requireProvider = async (headers: Headers) => {
  const { requireCapability } =
    await import("../../../../../../src/modules/identity/application/require-capability");
  return requireCapability(headers, "PROVIDER");
};

export const { GET } = createBidSummaryHandlers({
  requireProvider,
  summarize: getBidSummary,
});
