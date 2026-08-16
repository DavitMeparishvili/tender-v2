import type {
  CheckoutIntent,
  CheckoutSession,
  PaymentEventRecord,
  PaymentGateway,
} from "../ports/payment-gateway";

// The mock never fails a payment: this phase proves entitlement and
// disclosure, not payment failure handling, which arrives with the real
// provider in Phase 5 together with signature verification and retries.
export class MockPaymentGateway implements PaymentGateway {
  async createCheckout(intent: CheckoutIntent): Promise<CheckoutSession> {
    return {
      checkoutId: intent.checkoutId,
      confirmPath: `/api/access/checkout/${intent.checkoutId}/confirm`,
    };
  }

  async confirmCheckout(intent: CheckoutIntent): Promise<PaymentEventRecord> {
    return {
      // Derived from the checkout rather than randomly generated, so
      // confirming the same checkout twice produces the same idempotency key
      // and the second apply is a no-op instead of a second entitlement.
      externalEventId: `mock-payment-${intent.checkoutId}`,
      checkoutId: intent.checkoutId,
      status: "SUCCEEDED",
      rawPayload: {
        gateway: "mock",
        product: intent.product,
        tenderId: intent.tenderId,
        amountMinorUnits: intent.amountMinorUnits,
        currency: intent.currency,
      },
    };
  }
}

export const mockPaymentGateway = new MockPaymentGateway();
