import { z } from "zod";
import type { Clock, IdGenerator, Result } from "../../shared";
import { accessProductFor, type AccessProduct } from "../domain/access-product";
import type { Entitlement } from "../domain/entitlement";
import { isActiveEntitlement } from "../domain/disclosure-policy";
import type { CheckoutSession, PaymentGateway } from "../ports/payment-gateway";

export const startAccessCheckoutCommandSchema = z
  .object({
    product: z.enum(["SINGLE_TENDER", "MONTHLY_PROVIDER", "ANNUAL_PROVIDER"]),
    tenderId: z.string().uuid().optional(),
  })
  .strict();

export type StartAccessCheckoutCommand = z.output<
  typeof startAccessCheckoutCommandSchema
>;
export type AccessActor = Readonly<{ id: string }>;

export type StartCheckoutError =
  | "INVALID_INPUT"
  | "TENDER_REQUIRED"
  | "TENDER_NOT_ALLOWED"
  | "TENDER_NOT_FOUND"
  | "ALREADY_ENTITLED";

export type CheckoutView = Readonly<{
  checkoutId: string;
  product: AccessProduct["code"];
  amountMinorUnits: number;
  currency: AccessProduct["currency"];
  confirmPath: string;
}>;

export interface StartAccessCheckoutRepository {
  // Only checks existence and publication: a provider may buy access to a
  // tender whose deadline has already passed (they may still need to read the
  // record they bid on), so no deadline predicate belongs here.
  publishedTenderExists(tenderId: string): Promise<boolean>;
  listEntitlements(providerId: string): Promise<readonly Entitlement[]>;
  createCheckout(
    intent: Readonly<{
      checkoutId: string;
      providerId: string;
      product: AccessProduct["code"];
      tenderId: string | null;
      amountMinorUnits: number;
      currency: AccessProduct["currency"];
    }>,
    now: Date,
  ): Promise<void>;
}

export function createStartAccessCheckout(dependencies: {
  repository: StartAccessCheckoutRepository;
  gateway: PaymentGateway;
  ids: IdGenerator;
  clock: Clock;
}) {
  return async function startAccessCheckout(
    input: unknown,
    actor: AccessActor,
  ): Promise<Result<CheckoutView, StartCheckoutError>> {
    const parsed = startAccessCheckoutCommandSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

    const product = accessProductFor(parsed.data.product);
    if (product === undefined) return { ok: false, error: "INVALID_INPUT" };

    const tenderId = parsed.data.tenderId ?? null;
    if (product.requiresTender && tenderId === null) {
      return { ok: false, error: "TENDER_REQUIRED" };
    }
    // A subscription that named a tender would silently sell tender-scoped
    // access at the subscription price; reject rather than ignore the field.
    if (!product.requiresTender && tenderId !== null) {
      return { ok: false, error: "TENDER_NOT_ALLOWED" };
    }

    const now = dependencies.clock.now();
    if (tenderId !== null) {
      if (!(await dependencies.repository.publishedTenderExists(tenderId))) {
        return { ok: false, error: "TENDER_NOT_FOUND" };
      }
      const existing = await dependencies.repository.listEntitlements(actor.id);
      const alreadyEntitled = existing.some((entitlement) =>
        isActiveEntitlement(
          entitlement,
          { providerId: actor.id, tenderId },
          now,
        ),
      );
      // Charging again for access the provider already holds would be a
      // straightforward overcharge, so this is a rejection, not a no-op.
      if (alreadyEntitled) return { ok: false, error: "ALREADY_ENTITLED" };
    }

    const checkoutId = dependencies.ids.next();
    const intent = {
      checkoutId,
      providerId: actor.id,
      product: product.code,
      tenderId,
      amountMinorUnits: product.amountMinorUnits,
      currency: product.currency,
    };
    await dependencies.repository.createCheckout(intent, now);
    const session: CheckoutSession =
      await dependencies.gateway.createCheckout(intent);

    return {
      ok: true,
      value: {
        checkoutId,
        product: product.code,
        amountMinorUnits: product.amountMinorUnits,
        currency: product.currency,
        confirmPath: session.confirmPath,
      },
    };
  };
}

const systemIds: IdGenerator = { next: () => crypto.randomUUID() };
const systemClock: Clock = { now: () => new Date() };

export async function startAccessCheckout(
  input: unknown,
  actor: AccessActor,
): Promise<Result<CheckoutView, StartCheckoutError>> {
  const [{ prismaEntitlementRepository }, { mockPaymentGateway }] =
    await Promise.all([
      import("../infrastructure/prisma-entitlement-repository"),
      import("../infrastructure/mock-payment-gateway"),
    ]);
  return createStartAccessCheckout({
    repository: prismaEntitlementRepository,
    gateway: mockPaymentGateway,
    ids: systemIds,
    clock: systemClock,
  })(input, actor);
}
