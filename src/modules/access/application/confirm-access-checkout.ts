import type { Clock, IdGenerator, Result } from "../../shared";
import { accessProductFor } from "../domain/access-product";
import { entitlementExpiryFor } from "../domain/access-product";
import type { Entitlement } from "../domain/entitlement";
import type { PaymentGateway } from "../ports/payment-gateway";
import type { AccessActor } from "./start-access-checkout";

export type ConfirmCheckoutError =
  "CHECKOUT_NOT_FOUND" | "NOT_CHECKOUT_OWNER" | "PAYMENT_FAILED";

export type PendingCheckout = Readonly<{
  checkoutId: string;
  providerId: string;
  product: string;
  tenderId: string | null;
  amountMinorUnits: number;
  currency: "GEL" | "USD";
}>;

export interface ConfirmAccessCheckoutRepository {
  findCheckout(checkoutId: string): Promise<PendingCheckout | null>;
  // Applies the payment event and grants the entitlement in ONE transaction,
  // keyed on `externalEventId`. A replay returns the entitlement the first
  // apply produced instead of granting a second one.
  applyPaymentEvent(
    event: Readonly<{
      externalEventId: string;
      checkoutId: string;
      rawPayload: Readonly<Record<string, unknown>>;
    }>,
    grant: Readonly<{
      entitlementId: string;
      providerId: string;
      kind: Entitlement["kind"];
      tenderId: string | null;
      grantedAt: Date;
      expiresAt: Date | null;
    }>,
  ): Promise<Entitlement>;
}

export function createConfirmAccessCheckout(dependencies: {
  repository: ConfirmAccessCheckoutRepository;
  gateway: PaymentGateway;
  ids: IdGenerator;
  clock: Clock;
}) {
  return async function confirmAccessCheckout(
    checkoutId: string,
    actor: AccessActor,
  ): Promise<Result<Entitlement, ConfirmCheckoutError>> {
    const checkout = await dependencies.repository.findCheckout(checkoutId);
    if (checkout === null) return { ok: false, error: "CHECKOUT_NOT_FOUND" };
    // Confirming somebody else's checkout would grant them access the actor
    // paid for — or grant the actor access charged to another account.
    if (checkout.providerId !== actor.id) {
      return { ok: false, error: "NOT_CHECKOUT_OWNER" };
    }

    const product = accessProductFor(checkout.product);
    if (product === undefined) return { ok: false, error: "PAYMENT_FAILED" };

    const event = await dependencies.gateway.confirmCheckout({
      checkoutId: checkout.checkoutId,
      providerId: checkout.providerId,
      product: product.code,
      tenderId: checkout.tenderId,
      amountMinorUnits: checkout.amountMinorUnits,
      currency: product.currency,
    });
    if (event.status !== "SUCCEEDED") {
      return { ok: false, error: "PAYMENT_FAILED" };
    }

    const grantedAt = dependencies.clock.now();
    const entitlement = await dependencies.repository.applyPaymentEvent(
      {
        externalEventId: event.externalEventId,
        checkoutId: event.checkoutId,
        rawPayload: event.rawPayload,
      },
      {
        entitlementId: dependencies.ids.next(),
        providerId: checkout.providerId,
        kind: product.entitlementKind,
        tenderId: checkout.tenderId,
        grantedAt,
        expiresAt: entitlementExpiryFor(product, grantedAt),
      },
    );

    return { ok: true, value: entitlement };
  };
}

const systemIds: IdGenerator = { next: () => crypto.randomUUID() };
const systemClock: Clock = { now: () => new Date() };

export async function confirmAccessCheckout(
  checkoutId: string,
  actor: AccessActor,
): Promise<Result<Entitlement, ConfirmCheckoutError>> {
  const [{ prismaEntitlementRepository }, { mockPaymentGateway }] =
    await Promise.all([
      import("../infrastructure/prisma-entitlement-repository"),
      import("../infrastructure/mock-payment-gateway"),
    ]);
  return createConfirmAccessCheckout({
    repository: prismaEntitlementRepository,
    gateway: mockPaymentGateway,
    ids: systemIds,
    clock: systemClock,
  })(checkoutId, actor);
}
