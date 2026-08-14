import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health/ready", () => {
  it("returns service unavailable until database readiness is connected", async () => {
    const response = await GET();

    expect(response.status).toBe(503);
  });
});
