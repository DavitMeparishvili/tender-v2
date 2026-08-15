import { syncTenderLocation } from "../../../../../src/modules/tenders/application/sync-tender-location";
import { createLocationHandlers } from "../../../../../src/modules/tenders/http/tender-handlers";

const requireCustomer = async (headers: Headers) => {
  const { requireCapability } =
    await import("../../../../../src/modules/identity/application/require-capability");
  return requireCapability(headers, "CUSTOMER");
};

export const { PATCH } = createLocationHandlers({
  requireCustomer,
  syncLocation: syncTenderLocation,
});
