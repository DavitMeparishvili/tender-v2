import { describe, expect, it, vi } from "vitest";
import {
  createBidHandlers,
  createBidSummaryHandlers,
  createOwnBidHandlers,
} from "./bid-handlers";

const provider = async () =>
  ({ ok: true, value: { id: "provider-1" } }) as const;
const customer = async () => ({ ok: true, value: { id: "client-1" } }) as const;
const deniedProvider = async () =>
  ({ ok: false, error: "CAPABILITY_MISSING" }) as const;
const context = { params: Promise.resolve({ id: "tender-1" }) };

describe("createBidHandlers", () => {
  it("submits with the resolved provider, never a body-supplied one", async () => {
    const submit = vi.fn(
      async () => ({ ok: false, error: "NOT_ENTITLED" }) as const,
    );
    const { POST } = createBidHandlers({
      requireProvider: provider,
      requireCustomer: customer,
      submit,
      list: vi.fn(),
    });

    const response = await POST(
      new Request("http://localhost/api/tenders/tender-1/bids", {
        method: "POST",
        body: JSON.stringify({ amountMinorUnits: 1, providerId: "someone" }),
      }),
      { params: Promise.resolve({ id: "tender-1" }) },
    );

    // A provider who has not paid gets 402, which the UI turns into an
    // unlock prompt rather than a dead end.
    expect(response.status).toBe(402);
    expect(submit).toHaveBeenCalledWith(
      "tender-1",
      { amountMinorUnits: 1, providerId: "someone" },
      { id: "provider-1" },
    );
  });

  it("requires the CUSTOMER capability to compare bids", async () => {
    const list = vi.fn(async () => ({ ok: true, value: [] }) as const);
    const { GET } = createBidHandlers({
      requireProvider: deniedProvider,
      requireCustomer: customer,
      submit: vi.fn(),
      list,
    });

    const response = await GET(
      new Request("http://localhost/api/tenders/tender-1/bids"),
      { params: Promise.resolve({ id: "tender-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ bids: [] });
    expect(list).toHaveBeenCalledWith("tender-1", { id: "client-1" });
  });

  it("refuses a comparison request from a non-owner", async () => {
    const { GET } = createBidHandlers({
      requireProvider: provider,
      requireCustomer: customer,
      submit: vi.fn(),
      list: async () => ({ ok: false, error: "NOT_OWNER" }) as const,
    });

    const response = await GET(
      new Request("http://localhost/api/tenders/tender-1/bids"),
      { params: Promise.resolve({ id: "tender-1" }) },
    );

    expect(response.status).toBe(403);
  });
});

describe("createOwnBidHandlers", () => {
  it("maps a post-deadline revision to 409", async () => {
    const { PATCH } = createOwnBidHandlers({
      requireProvider: provider,
      revise: async () => ({ ok: false, error: "DEADLINE_PASSED" }) as const,
      withdraw: vi.fn(),
    });

    const response = await PATCH(
      new Request("http://localhost/api/tenders/tender-1/bids/mine", {
        method: "PATCH",
        body: JSON.stringify({ amountMinorUnits: 1 }),
      }),
      { params: Promise.resolve({ id: "tender-1" }) },
    );

    expect(response.status).toBe(409);
  });

  it("withdraws the caller's own bid without reading a body", async () => {
    const withdraw = vi.fn(
      async () => ({ ok: false, error: "BID_NOT_FOUND" }) as const,
    );
    const { DELETE } = createOwnBidHandlers({
      requireProvider: provider,
      revise: vi.fn(),
      withdraw,
    });

    const response = await DELETE(
      new Request("http://localhost/api/tenders/tender-1/bids/mine", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "tender-1" }) },
    );

    expect(response.status).toBe(404);
    expect(withdraw).toHaveBeenCalledWith("tender-1", { id: "provider-1" });
  });
});

describe("createBidSummaryHandlers", () => {
  it("returns only the count and the lowest amount", async () => {
    const { GET } = createBidSummaryHandlers({
      requireProvider: provider,
      summarize: async () =>
        ({
          ok: true,
          value: {
            bidCount: 3,
            lowestAmountMinorUnits: 42_000,
            currency: "GEL",
          },
        }) as const,
    });

    const response = await GET(
      new Request("http://localhost/api/tenders/tender-1/bids/summary"),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      summary: { bidCount: 3, lowestAmountMinorUnits: 42_000, currency: "GEL" },
    });
  });
});
