import { reviseBid } from "../../../../../../src/modules/bidding/application/revise-bid";
import { withdrawBid } from "../../../../../../src/modules/bidding/application/withdraw-bid";
import { createOwnBidHandlers } from "../../../../../../src/modules/bidding/http/bid-handlers";

const requireProvider = async (headers: Headers) => {
  const { requireCapability } =
    await import("../../../../../../src/modules/identity/application/require-capability");
  return requireCapability(headers, "PROVIDER");
};

export const { PATCH, DELETE } = createOwnBidHandlers({
  requireProvider,
  revise: reviseBid,
  withdraw: withdrawBid,
});
