import { describe, expect, it } from "vitest";
import { createIsTenderOwnedBy } from "./is-tender-owned-by";

const isTenderOwnedBy = createIsTenderOwnedBy({
  isOwnedBy: async (tenderId, userId) =>
    tenderId === "tender-1" && userId === "client-1",
});

describe("isTenderOwnedBy", () => {
  it("is true only for the tender's owner", async () => {
    expect(await isTenderOwnedBy("tender-1", "client-1")).toBe(true);
    expect(await isTenderOwnedBy("tender-1", "client-2")).toBe(false);
    expect(await isTenderOwnedBy("tender-2", "client-1")).toBe(false);
  });
});
