import { startAccessCheckout } from "../../../../src/modules/access/application/start-access-checkout";
import { createCheckoutHandlers } from "../../../../src/modules/access/http/access-handlers";

const requireProvider = async (headers: Headers) => {
  const { requireCapability } =
    await import("../../../../src/modules/identity/application/require-capability");
  return requireCapability(headers, "PROVIDER");
};

export const { POST } = createCheckoutHandlers({
  requireProvider,
  start: startAccessCheckout,
});
