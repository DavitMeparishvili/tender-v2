import { describe, expect, it } from "vitest";
import {
  AGREEMENT_WORKER_HEADER,
  createExpiryHandlers,
} from "./expiry-handlers";
describe("expiry handlers", () => {
  it("requires the worker secret", async () => {
    const h = createExpiryHandlers({
      secret: "x".repeat(32),
      expireDue: async () => [],
    });
    expect(
      (await h.POST(new Request("http://x", { method: "POST" }))).status,
    ).toBe(401);
    expect(
      (
        await h.POST(
          new Request("http://x", {
            method: "POST",
            headers: { [AGREEMENT_WORKER_HEADER]: "x".repeat(32) },
          }),
        )
      ).status,
    ).toBe(200);
  });
});
