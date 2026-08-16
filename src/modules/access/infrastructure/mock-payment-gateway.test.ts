import { describe, expect, it } from "vitest";
import type { CheckoutIntent } from "../ports/payment-gateway";
import { mockPaymentGateway } from "./mock-payment-gateway";

const intent: CheckoutIntent = {
  checkoutId: "checkout-1",
  providerId: "provider-1",
  product: "SINGLE_TENDER",
  tenderId: "tender-1",
  amountMinorUnits: 100,
  currency: "USD",
};

describe("mockPaymentGateway", () => {
  it("returns a confirm path scoped to the checkout", async () => {
    const session = await mockPaymentGateway.createCheckout(intent);
    expect(session).toEqual({
      checkoutId: "checkout-1",
      confirmPath: "/api/access/checkout/checkout-1/confirm",
    });
  });

  it("derives a deterministic event id so a replay cannot double-grant", async () => {
    const first = await mockPaymentGateway.confirmCheckout(intent);
    const second = await mockPaymentGateway.confirmCheckout(intent);
    expect(first.externalEventId).toBe("mock-payment-checkout-1");
    expect(second.externalEventId).toBe(first.externalEventId);
    expect(first.status).toBe("SUCCEEDED");
  });

  it("records the purchased amount in the raw payload it hands back", async () => {
    const event = await mockPaymentGateway.confirmCheckout(intent);
    expect(event.rawPayload).toEqual({
      gateway: "mock",
      product: "SINGLE_TENDER",
      tenderId: "tender-1",
      amountMinorUnits: 100,
      currency: "USD",
    });
  });
});
