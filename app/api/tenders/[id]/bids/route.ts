import { listTenderBids } from "../../../../../src/modules/bidding/application/list-tender-bids";
import { submitBid } from "../../../../../src/modules/bidding/application/submit-bid";
import { createBidHandlers } from "../../../../../src/modules/bidding/http/bid-handlers";

const requireProvider = async (headers: Headers) => {
  const { requireCapability } =
    await import("../../../../../src/modules/identity/application/require-capability");
  return requireCapability(headers, "PROVIDER");
};
const requireCustomer = async (headers: Headers) => {
  const { requireCapability } =
    await import("../../../../../src/modules/identity/application/require-capability");
  return requireCapability(headers, "CUSTOMER");
};

export const { POST, GET } = createBidHandlers({
  requireProvider,
  requireCustomer,
  submit: submitBid,
  list: listTenderBids,
});
