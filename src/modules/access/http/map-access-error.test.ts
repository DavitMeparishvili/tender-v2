import { describe, expect, it } from "vitest";
import { ACCESS_ERROR_MESSAGE_KEYS, mapAccessError } from "./map-access-error";

describe("mapAccessError", () => {
  it("maps authentication and authorization denials to their identity status", async () => {
    expect(mapAccessError("UNAUTHENTICATED").status).toBe(401);
    expect(mapAccessError("CAPABILITY_MISSING").status).toBe(403);
  });

  it("maps access-specific failures to precise statuses", () => {
    expect(mapAccessError("INVALID_INPUT").status).toBe(400);
    expect(mapAccessError("TENDER_REQUIRED").status).toBe(400);
    expect(mapAccessError("TENDER_NOT_ALLOWED").status).toBe(400);
    expect(mapAccessError("TENDER_NOT_FOUND").status).toBe(404);
    expect(mapAccessError("CHECKOUT_NOT_FOUND").status).toBe(404);
    expect(mapAccessError("NOT_CHECKOUT_OWNER").status).toBe(403);
    expect(mapAccessError("ALREADY_ENTITLED").status).toBe(409);
    expect(mapAccessError("PAYMENT_FAILED").status).toBe(402);
  });

  it("returns the error code and a resolvable message key in the body", async () => {
    const body: unknown = await mapAccessError("ALREADY_ENTITLED").json();
    expect(body).toEqual({
      code: "ALREADY_ENTITLED",
      messageKey: ACCESS_ERROR_MESSAGE_KEYS.ALREADY_ENTITLED,
    });
  });
});
