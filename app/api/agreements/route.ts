import { listAgreements } from "../../../src/modules/agreements/application/get-agreement";
import { createAgreementHandlers } from "../../../src/modules/agreements/http/agreement-handlers";
import { requireAnyCommercialCapability } from "../../../src/modules/identity/application/require-capability";
export const { list: GET } = createAgreementHandlers({
  require: requireAnyCommercialCapability,
  list: listAgreements,
  get: async () => ({ ok: false, error: "AGREEMENT_NOT_FOUND" }),
  manage: async () => ({ ok: false, error: "AGREEMENT_NOT_FOUND" }),
});
