import { describe, expect, it } from "vitest";
import { matchesWorkerSecret } from "./worker-secret";

describe("matchesWorkerSecret", () => {
  it("accepts only an exact value", () => {
    expect(matchesWorkerSecret("a".repeat(32), "a".repeat(32))).toBe(true);
    expect(matchesWorkerSecret("a".repeat(31), "a".repeat(32))).toBe(false);
    expect(matchesWorkerSecret(null, "a".repeat(32))).toBe(false);
  });
});
