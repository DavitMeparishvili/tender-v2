import { listActiveEntitlements } from "../../../../src/modules/access/application/list-active-entitlements";
import { createEntitlementHandlers } from "../../../../src/modules/access/http/access-handlers";

const requireProvider = async (headers: Headers) => {
  const { requireCapability } =
    await import("../../../../src/modules/identity/application/require-capability");
  return requireCapability(headers, "PROVIDER");
};

export const { GET } = createEntitlementHandlers({
  requireProvider,
  list: listActiveEntitlements,
});
