import { getOwnedTender } from "../../../../src/modules/tenders/application/get-owned-tender";
import { updateTenderDraft } from "../../../../src/modules/tenders/application/update-tender-draft";
import { createOwnedTenderHandlers } from "../../../../src/modules/tenders/http/tender-handlers";

const requireCustomer = async (headers: Headers) => {
  const { requireCapability } =
    await import("../../../../src/modules/identity/application/require-capability");
  return requireCapability(headers, "CUSTOMER");
};

export const { GET, PATCH } = createOwnedTenderHandlers({
  requireCustomer,
  getOwned: getOwnedTender,
  updateDraft: updateTenderDraft,
});
