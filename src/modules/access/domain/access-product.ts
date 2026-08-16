import type { Currency } from "../../shared";
import type { EntitlementKind } from "./entitlement";

export type AccessProductCode =
  "SINGLE_TENDER" | "MONTHLY_PROVIDER" | "ANNUAL_PROVIDER";

export type AccessProduct = Readonly<{
  code: AccessProductCode;
  entitlementKind: EntitlementKind;
  // Integer minor units, matching the platform-wide money rule. USD 1 / 20 /
  // 200 are the amounts the source documents fix; changing them requires a
  // spec revision, not a code edit.
  amountMinorUnits: number;
  currency: Currency;
  durationDays: number | null;
  requiresTender: boolean;
}>;

const DAY_MS = 24 * 60 * 60 * 1000;

export const ACCESS_PRODUCTS: Readonly<
  Record<AccessProductCode, AccessProduct>
> = {
  SINGLE_TENDER: {
    code: "SINGLE_TENDER",
    entitlementKind: "SINGLE_TENDER",
    amountMinorUnits: 100,
    currency: "USD",
    durationDays: null,
    requiresTender: true,
  },
  MONTHLY_PROVIDER: {
    code: "MONTHLY_PROVIDER",
    entitlementKind: "MONTHLY_PROVIDER",
    amountMinorUnits: 2_000,
    currency: "USD",
    durationDays: 30,
    requiresTender: false,
  },
  ANNUAL_PROVIDER: {
    code: "ANNUAL_PROVIDER",
    entitlementKind: "ANNUAL_PROVIDER",
    amountMinorUnits: 20_000,
    currency: "USD",
    durationDays: 365,
    requiresTender: false,
  },
};

// `ADMIN_OVERRIDE` is deliberately unreachable here: it is an entitlement
// kind, not a purchasable product, so no checkout can ever mint one.
export function accessProductFor(code: string): AccessProduct | undefined {
  return Object.hasOwn(ACCESS_PRODUCTS, code)
    ? ACCESS_PRODUCTS[code as AccessProductCode]
    : undefined;
}

export function entitlementExpiryFor(
  product: AccessProduct,
  grantedAt: Date,
): Date | null {
  return product.durationDays === null
    ? null
    : new Date(grantedAt.getTime() + product.durationDays * DAY_MS);
}
