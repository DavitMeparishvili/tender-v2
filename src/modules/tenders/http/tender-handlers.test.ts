import { describe, expect, it } from "vitest";
import {
  createCancelHandlers,
  createLocationHandlers,
  createOwnedTenderHandlers,
  createPublishHandlers,
  createTenderHandlers,
} from "./tender-handlers";

function jsonRequest(
  body: unknown,
  method: "POST" | "PATCH" = "POST",
): Request {
  return new Request("http://localhost/api/tenders", {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const authorizedActor = async () =>
  ({ ok: true, value: { id: "user-1" } }) as const;

function routeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("tender handlers", () => {
  it("returns 401 when the caller has no authorized customer session", async () => {
    const handlers = createTenderHandlers({
      requireCustomer: async () => ({ ok: false, error: "UNAUTHENTICATED" }),
      createDraft: async () => ({ ok: true, value: {} as never }),
      listOwned: async () => [],
    });
    const response = await handlers.POST(
      jsonRequest({ specialty: "CONSTRUCTION_REPAIR", title: "x" }),
    );
    expect(response.status).toBe(401);
  });

  it("returns 403 when an authenticated caller lacks the customer capability", async () => {
    const handlers = createTenderHandlers({
      requireCustomer: async () => ({ ok: false, error: "CAPABILITY_MISSING" }),
      createDraft: async () => ({ ok: true, value: {} as never }),
      listOwned: async () => [],
    });
    const response = await handlers.POST(
      jsonRequest({
        specialty: "CONSTRUCTION_REPAIR",
        title: "Repaint two rooms",
      }),
    );
    expect(response.status).toBe(403);
  });

  it("returns 400 for a malformed create body once authorized", async () => {
    const handlers = createTenderHandlers({
      requireCustomer: async () => ({ ok: true, value: { id: "user-1" } }),
      createDraft: async () => ({ ok: false, error: "INVALID_INPUT" }),
      listOwned: async () => [],
    });
    const response = await handlers.POST(jsonRequest({}));
    expect(response.status).toBe(400);
  });
});

describe("owned tender handlers", () => {
  it("returns the owned tender on success", async () => {
    const handlers = createOwnedTenderHandlers({
      requireCustomer: authorizedActor,
      getOwned: async () => ({ ok: true, value: { id: "tender-1" } as never }),
      updateDraft: async () => ({ ok: true, value: {} as never }),
    });
    const response = await handlers.GET(
      new Request("http://localhost/api/tenders/tender-1"),
      routeContext("tender-1"),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      tender: { id: "tender-1" },
    });
  });

  it("maps a not-owner error to 403", async () => {
    const handlers = createOwnedTenderHandlers({
      requireCustomer: authorizedActor,
      getOwned: async () => ({ ok: false, error: "NOT_OWNER" }),
      updateDraft: async () => ({ ok: true, value: {} as never }),
    });
    const response = await handlers.GET(
      new Request("http://localhost/api/tenders/tender-1"),
      routeContext("tender-1"),
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "NOT_OWNER",
    });
  });
});

describe("location handlers", () => {
  it("returns the updated tender on success", async () => {
    const handlers = createLocationHandlers({
      requireCustomer: authorizedActor,
      syncLocation: async () => ({
        ok: true,
        value: { id: "tender-1", location: {} } as never,
      }),
    });
    const response = await handlers.PATCH(
      jsonRequest(
        { mode: "PIN", city: "Tbilisi", latitude: 41.7, longitude: 44.8 },
        "PATCH",
      ),
      routeContext("tender-1"),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      tender: { id: "tender-1", location: {} },
    });
  });

  it("maps an address-not-found error to 422", async () => {
    const handlers = createLocationHandlers({
      requireCustomer: authorizedActor,
      syncLocation: async () => ({ ok: false, error: "ADDRESS_NOT_FOUND" }),
    });
    const response = await handlers.PATCH(
      jsonRequest(
        { mode: "ADDRESS", city: "Nowhere", addressLine: "1 Nowhere Ave" },
        "PATCH",
      ),
      routeContext("tender-1"),
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: "ADDRESS_NOT_FOUND",
    });
  });
});

describe("publish handlers", () => {
  it("returns the published tender on success", async () => {
    const handlers = createPublishHandlers({
      requireCustomer: authorizedActor,
      publish: async () => ({
        ok: true,
        value: { id: "tender-1", status: "PUBLISHED" } as never,
      }),
    });
    const response = await handlers.POST(
      new Request("http://localhost/api/tenders/tender-1/publish", {
        method: "POST",
      }),
      routeContext("tender-1"),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      tender: { id: "tender-1", status: "PUBLISHED" },
    });
  });

  it("surfaces the exact publication-blocking reason code and a 400 status", async () => {
    const handlers = createPublishHandlers({
      requireCustomer: authorizedActor,
      publish: async () => ({ ok: false, error: "TITLE_REQUIRED" }),
    });
    const response = await handlers.POST(
      new Request("http://localhost/api/tenders/tender-1/publish", {
        method: "POST",
      }),
      routeContext("tender-1"),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "TITLE_REQUIRED",
    });
  });
});

describe("cancel handlers", () => {
  it("returns the cancelled tender on success", async () => {
    const handlers = createCancelHandlers({
      requireCustomer: authorizedActor,
      cancel: async () => ({
        ok: true,
        value: { id: "tender-1", status: "CANCELLED" } as never,
      }),
    });
    const response = await handlers.POST(
      jsonRequest({ reason: "No longer needed" }),
      routeContext("tender-1"),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      tender: { id: "tender-1", status: "CANCELLED" },
    });
  });

  it("maps an already-cancelled error to 409", async () => {
    const handlers = createCancelHandlers({
      requireCustomer: authorizedActor,
      cancel: async () => ({ ok: false, error: "ALREADY_CANCELLED" }),
    });
    const response = await handlers.POST(
      jsonRequest({ reason: "No longer needed" }),
      routeContext("tender-1"),
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "ALREADY_CANCELLED",
    });
  });
});
