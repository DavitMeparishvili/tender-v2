import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkDatabaseReadiness } from "@/src/infrastructure/db/readiness";
import { GET } from "./route";

vi.mock("@/src/infrastructure/db/readiness", () => ({
  checkDatabaseReadiness: vi.fn(),
}));

const mockedCheckDatabaseReadiness = vi.mocked(checkDatabaseReadiness);

describe("GET /api/health/ready", () => {
  beforeEach(() => {
    mockedCheckDatabaseReadiness.mockReset();
  });

  it("returns ok when PostgreSQL is ready", async () => {
    mockedCheckDatabaseReadiness.mockResolvedValue({ ok: true });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("fails safely when PostgreSQL is unavailable", async () => {
    mockedCheckDatabaseReadiness.mockResolvedValue({
      ok: false,
      reason: "database_unavailable",
    });

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: "unavailable",
      reason: "database_unavailable",
    });
  });
});
