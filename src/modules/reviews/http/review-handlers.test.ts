import { describe, expect, it } from "vitest";
import { createReviewHandlers } from "./review-handlers";

const valid = {
  quality: 5,
  deadline: 4,
  communication: 5,
  agreedPrice: 4,
  comment: "Careful work, clear updates, and the agreed price was kept.",
};
const moderationDependencies = {
  requireAdmin: async () => ({ ok: true as const, value: { id: "admin" } }),
  listForModeration: async () => [],
  redact: async () => ({ ok: true as const, value: {} }),
};

describe("review handlers", () => {
  it("uses strict input and maps publication errors", async () => {
    const handlers = createReviewHandlers({
      ...moderationDependencies,
      require: async () => ({ ok: true as const, value: { id: "reviewer" } }),
      publish: async (_id, input) =>
        typeof input === "object" && input !== null && "extra" in input
          ? { ok: false as const, error: "INVALID_REVIEW" as const }
          : { ok: false as const, error: "REVIEW_ALREADY_EXISTS" as const },
      getForProfile: async () => ({ aggregate: {}, reviews: [] }),
    });
    expect(
      (
        await handlers.publish(
          new Request("http://x", {
            method: "POST",
            body: JSON.stringify({ ...valid, extra: true }),
          }),
          "agreement",
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await handlers.publish(
          new Request("http://x", {
            method: "POST",
            body: JSON.stringify(valid),
          }),
          "agreement",
        )
      ).status,
    ).toBe(409);
  });

  it("does not require authentication for public profile review reads", async () => {
    const handlers = createReviewHandlers({
      ...moderationDependencies,
      require: async () => ({ ok: false as const, error: "UNAUTHENTICATED" }),
      publish: async () => ({ ok: false as const, error: "NOT_PARTICIPANT" }),
      getForProfile: async (id) => ({
        aggregate: { reviewCount: 0 },
        reviews: [id],
      }),
    });
    const response = await handlers.listForProfile("profile");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      aggregate: { reviewCount: 0 },
      reviews: ["profile"],
    });
  });
});
