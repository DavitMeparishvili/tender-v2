import { describe, expect, it, vi } from "vitest";
import {
  createCheckoutConfirmHandlers,
  createCheckoutHandlers,
  createEntitlementHandlers,
} from "./access-handlers";

const grantedProvider = async () =>
  ({ ok: true, value: { id: "provider-1" } }) as const;
const deniedProvider = async () =>
  ({ ok: false, error: "CAPABILITY_MISSING" }) as const;

describe("createCheckoutHandlers", () => {
  it("rejects a caller without the PROVIDER capability before reading the body", async () => {
    const start = vi.fn();
    const { POST } = createCheckoutHandlers({
      requireProvider: deniedProvider,
      start,
    });

    const response = await POST(
      new Request("http://localhost/api/access/checkout", {
        method: "POST",
        body: JSON.stringify({ product: "MONTHLY_PROVIDER" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(start).not.toHaveBeenCalled();
  });

  it("passes the resolved actor, never a client-supplied provider id", async () => {
    const start = vi.fn(async () => ({
      ok: true as const,
      value: {
        checkoutId: "checkout-1",
        product: "MONTHLY_PROVIDER" as const,
        amountMinorUnits: 2_000,
        currency: "USD" as const,
        confirmPath: "/api/access/checkout/checkout-1/confirm",
      },
    }));
    const { POST } = createCheckoutHandlers({
      requireProvider: grantedProvider,
      start,
    });

    const response = await POST(
      new Request("http://localhost/api/access/checkout", {
        method: "POST",
        body: JSON.stringify({
          product: "MONTHLY_PROVIDER",
          providerId: "somebody-else",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(start).toHaveBeenCalledWith(
      { product: "MONTHLY_PROVIDER", providerId: "somebody-else" },
      { id: "provider-1" },
    );
  });
});

describe("createCheckoutConfirmHandlers", () => {
  it("confirms the checkout named by the route parameter", async () => {
    const confirm = vi.fn(async () => ({
      ok: true as const,
      value: {
        id: "entitlement-1",
        providerId: "provider-1",
        kind: "SINGLE_TENDER" as const,
        tenderId: "tender-1",
        grantedAt: new Date("2026-06-01T00:00:00.000Z"),
        expiresAt: null,
      },
    }));
    const { POST } = createCheckoutConfirmHandlers({
      requireProvider: grantedProvider,
      confirm,
    });

    const response = await POST(
      new Request("http://localhost/api/access/checkout/checkout-1/confirm", {
        method: "POST",
      }),
      { params: Promise.resolve({ checkoutId: "checkout-1" }) },
    );

    expect(response.status).toBe(200);
    expect(confirm).toHaveBeenCalledWith("checkout-1", { id: "provider-1" });
  });

  it("maps a declined payment to 402", async () => {
    const { POST } = createCheckoutConfirmHandlers({
      requireProvider: grantedProvider,
      confirm: async () => ({ ok: false, error: "PAYMENT_FAILED" }) as const,
    });

    const response = await POST(
      new Request("http://localhost/api/access/checkout/checkout-1/confirm", {
        method: "POST",
      }),
      { params: Promise.resolve({ checkoutId: "checkout-1" }) },
    );

    expect(response.status).toBe(402);
  });
});

describe("createEntitlementHandlers", () => {
  it("returns only the caller's own entitlements", async () => {
    const list = vi.fn(async () => []);
    const { GET } = createEntitlementHandlers({
      requireProvider: grantedProvider,
      list,
    });

    const response = await GET(
      new Request("http://localhost/api/access/entitlements"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ entitlements: [] });
    expect(list).toHaveBeenCalledWith({ id: "provider-1" });
  });
});
