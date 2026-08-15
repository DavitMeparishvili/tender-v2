import { describe, expect, it } from "vitest";
import { createTenderHandlers } from "./tender-handlers";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/tenders", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
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
