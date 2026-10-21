import { chooseWinningBid } from "../../../../../../../src/modules/bidding/application/choose-winning-bid";
import { createChooseBidHandlers } from "../../../../../../../src/modules/bidding/http/bid-handlers";

const requireCustomer = async (headers: Headers) => {
  const { requireCapability } =
    await import("../../../../../../../src/modules/identity/application/require-capability");
  return requireCapability(headers, "CUSTOMER");
};

export const { POST } = createChooseBidHandlers({
  requireCustomer,
  choose: (tenderId, bidId, actor) => chooseWinningBid(tenderId, bidId, actor),
});
