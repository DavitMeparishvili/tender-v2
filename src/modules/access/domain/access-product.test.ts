import { describe, expect, it } from "vitest";
import {
  ACCESS_PRODUCTS,
  accessProductFor,
  entitlementExpiryFor,
} from "./access-product";

describe("ACCESS_PRODUCTS", () => {
  it("prices access exactly as the source documents require", () => {
    expect(ACCESS_PRODUCTS.SINGLE_TENDER.amountMinorUnits).toBe(100);
    expect(ACCESS_PRODUCTS.MONTHLY_PROVIDER.amountMinorUnits).toBe(2_000);
    expect(ACCESS_PRODUCTS.ANNUAL_PROVIDER.amountMinorUnits).toBe(20_000);
    for (const product of Object.values(ACCESS_PRODUCTS)) {
      expect(product.currency).toBe("USD");
    }
  });

  it("requires a tender only for single-tender access", () => {
    expect(ACCESS_PRODUCTS.SINGLE_TENDER.requiresTender).toBe(true);
    expect(ACCESS_PRODUCTS.MONTHLY_PROVIDER.requiresTender).toBe(false);
    expect(ACCESS_PRODUCTS.ANNUAL_PROVIDER.requiresTender).toBe(false);
  });
});

describe("accessProductFor", () => {
  it("resolves a known code and rejects anything else", () => {
    expect(accessProductFor("MONTHLY_PROVIDER")).toBe(
      ACCESS_PRODUCTS.MONTHLY_PROVIDER,
    );
    expect(accessProductFor("ADMIN_OVERRIDE")).toBeUndefined();
    expect(accessProductFor("free")).toBeUndefined();
  });
});

describe("entitlementExpiryFor", () => {
  const grantedAt = new Date("2026-03-01T00:00:00.000Z");

  it("never expires single-tender access", () => {
    expect(
      entitlementExpiryFor(ACCESS_PRODUCTS.SINGLE_TENDER, grantedAt),
    ).toBeNull();
  });

  it("expires a monthly subscription 30 days after the grant", () => {
    expect(
      entitlementExpiryFor(ACCESS_PRODUCTS.MONTHLY_PROVIDER, grantedAt),
    ).toEqual(new Date("2026-03-31T00:00:00.000Z"));
  });

  it("expires an annual subscription 365 days after the grant", () => {
    expect(
      entitlementExpiryFor(ACCESS_PRODUCTS.ANNUAL_PROVIDER, grantedAt),
    ).toEqual(new Date("2027-03-01T00:00:00.000Z"));
  });
});
