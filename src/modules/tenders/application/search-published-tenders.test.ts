import { describe, expect, it, vi } from "vitest";
import { MAX_BUDGET_MINOR_UNITS } from "../domain/constraints";
import {
  createSearchPublishedTenders,
  searchPublishedTendersQuerySchema,
} from "./search-published-tenders";

const clock = { now: () => new Date("2026-08-15T00:00:00.000Z") };

describe("searchPublishedTendersQuerySchema", () => {
  it("rejects a lower budget bound with no currency to scope it", () => {
    expect(
      searchPublishedTendersQuerySchema.safeParse({
        minBudgetMinorUnits: "100000",
      }).success,
    ).toBe(false);
  });

  it("rejects an upper budget bound with no currency to scope it", () => {
    expect(
      searchPublishedTendersQuerySchema.safeParse({
        maxBudgetMinorUnits: "100000",
      }).success,
    ).toBe(false);
  });

  it("accepts a budget bound once a currency scopes the comparison", () => {
    expect(
      searchPublishedTendersQuerySchema.safeParse({
        currency: "GEL",
        minBudgetMinorUnits: "100000",
        maxBudgetMinorUnits: "500000",
      }).success,
    ).toBe(true);
  });

  it("leaves a currency-only filter alone", () => {
    expect(
      searchPublishedTendersQuerySchema.safeParse({ currency: "USD" }).success,
    ).toBe(true);
  });

  it("rejects a budget bound above the INTEGER column's ceiling", () => {
    expect(
      searchPublishedTendersQuerySchema.safeParse({
        currency: "GEL",
        maxBudgetMinorUnits: String(MAX_BUDGET_MINOR_UNITS + 1),
      }).success,
    ).toBe(false);
  });
});

describe("createSearchPublishedTenders", () => {
  it("refuses an unscoped budget bound without querying the repository", async () => {
    const searchPublished = vi.fn();
    const search = createSearchPublishedTenders({
      repository: { searchPublished },
      clock,
    });

    await expect(search({ minBudgetMinorUnits: "100000" })).resolves.toEqual({
      ok: false,
      error: "INVALID_INPUT",
    });
    expect(searchPublished).not.toHaveBeenCalled();
  });
});
