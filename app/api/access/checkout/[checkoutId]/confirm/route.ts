import { confirmAccessCheckout } from "../../../../../../src/modules/access/application/confirm-access-checkout";
import { createCheckoutConfirmHandlers } from "../../../../../../src/modules/access/http/access-handlers";

const requireProvider = async (headers: Headers) => {
  const { requireCapability } =
    await import("../../../../../../src/modules/identity/application/require-capability");
  return requireCapability(headers, "PROVIDER");
};

export const { POST } = createCheckoutConfirmHandlers({
  requireProvider,
  confirm: confirmAccessCheckout,
});
