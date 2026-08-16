import { describe, expect, it } from "vitest";
import { createAgreementHandlers } from "./agreement-handlers";
const actor = { id: "party" };
describe("agreement handlers", () => {
  const handlers = createAgreementHandlers({
    require: async () => ({ ok: true as const, value: actor }),
    list: async () => [],
    get: async () => ({ ok: false as const, error: "AGREEMENT_NOT_FOUND" }),
    manage: async () => ({ ok: false as const, error: "NOT_PARTICIPANT" }),
  });
  it("rejects invalid role and strict command bodies", async () => {
    expect(
      (await handlers.list(new Request("http://x/api/agreements?role=ADMIN")))
        .status,
    ).toBe(422);
    expect(
      (
        await handlers.patch(
          new Request("http://x", {
            method: "PATCH",
            body: JSON.stringify({ action: "CONFIRM", actorId: "spoof" }),
          }),
          "id",
        )
      ).status,
    ).toBe(422);
  });
  it("maps absent and outsider agreements", async () => {
    expect((await handlers.get(new Request("http://x"), "id")).status).toBe(
      404,
    );
    expect(
      (
        await handlers.patch(
          new Request("http://x", {
            method: "PATCH",
            body: JSON.stringify({ action: "CONFIRM" }),
          }),
          "id",
        )
      ).status,
    ).toBe(403);
  });
});
