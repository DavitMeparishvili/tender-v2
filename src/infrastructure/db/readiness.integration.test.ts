import { expect, it } from "vitest";
import { checkDatabaseReadiness } from "./readiness";

it("round-trips a PostgreSQL readiness query", async () => {
  await expect(checkDatabaseReadiness()).resolves.toEqual({ ok: true });
});
