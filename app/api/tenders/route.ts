import { createTenderDraft } from "../../../src/modules/tenders/application/create-tender-draft";
import { listOwnedTenders } from "../../../src/modules/tenders/application/list-owned-tenders";
import { createTenderHandlers } from "../../../src/modules/tenders/http/tender-handlers";

const requireCustomer = async (headers: Headers) => {
  const { requireCapability } =
    await import("../../../src/modules/identity/application/require-capability");
  return requireCapability(headers, "CUSTOMER");
};

export const { POST, GET } = createTenderHandlers({
  requireCustomer,
  createDraft: createTenderDraft,
  listOwned: listOwnedTenders,
});
