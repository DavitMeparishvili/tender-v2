import { beforeEach, expect, it, vi } from "vitest";

const queryRaw = vi.hoisted(() => vi.fn());

vi.mock("./client", () => ({
  database: { $queryRaw: queryRaw },
}));

import { GET } from "../../../app/api/health/ready/route";
import { checkDatabaseReadiness } from "./readiness";

beforeEach(() => {
  queryRaw.mockReset();
});

it("maps a rejected readiness query to a redacted result and 503 response", async () => {
  const sensitiveDetail =
    "query timeout at postgresql://private-user:private-password@db.internal/tender_test";
  queryRaw.mockRejectedValue(new Error(sensitiveDetail));

  await expect(checkDatabaseReadiness()).resolves.toEqual({
    ok: false,
    reason: "database_unavailable",
  });

  const response = await GET();
  const body: unknown = await response.json();

  expect(response.status).toBe(503);
  expect(body).toEqual({
    status: "unavailable",
    reason: "database_unavailable",
  });
  expect(JSON.stringify(body)).not.toContain(sensitiveDetail);
  expect(JSON.stringify(body)).not.toContain("private-password");
});
