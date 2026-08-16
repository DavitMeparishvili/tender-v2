import type { Currency } from "../../shared";
import type { AccessProductCode } from "../domain/access-product";

export type CheckoutIntent = Readonly<{
  checkoutId: string;
  providerId: string;
  product: AccessProductCode;
  tenderId: string | null;
  amountMinorUnits: number;
  currency: Currency;
}>;

export type CheckoutSession = Readonly<{
  checkoutId: string;
  // Where the browser posts to complete payment. A hosted Phase 5 provider
  // returns its own absolute URL here instead; the shape does not change.
  confirmPath: string;
}>;

export type PaymentEventRecord = Readonly<{
  // The idempotency key a Phase 5 webhook will carry verbatim.
  externalEventId: string;
  checkoutId: string;
  status: "SUCCEEDED" | "FAILED" | "CANCELLED";
  rawPayload: Readonly<Record<string, unknown>>;
}>;

export interface PaymentGateway {
  createCheckout(intent: CheckoutIntent): Promise<CheckoutSession>;
  confirmCheckout(intent: CheckoutIntent): Promise<PaymentEventRecord>;
}
