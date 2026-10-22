import { describe, expect, it } from "vitest";
import type { PublicTenderSummary } from "../domain/masking";
import {
  DISCOVERY_SORTS,
  paginateTenders,
  sortTenders,
  type DiscoverySort,
} from "./discovery-view";

function tender(
  id: string,
  overrides: Partial<PublicTenderSummary> = {},
): PublicTenderSummary {
  return {
    id,
    title: id,
    shortDescription: "Short",
    specialty: "CONSTRUCTION_REPAIR",
    serviceCode: "PAINTING_DECORATING",
    status: "PUBLISHED",
    budgetMinorUnits: 100_000,
    currency: "GEL",
    city: "Tbilisi",
    district: null,
    publicLatitude: 41.7,
    publicLongitude: 44.8,
    publishedAt: "2026-06-01T00:00:00.000Z",
    deadline: "2026-07-01T00:00:00.000Z",
    ownerIsVip: false,
    ...overrides,
  };
}

// Every standard row is better than the VIP row on each sort key, so a VIP row
// that still lands first can only have come from the VIP key.
const rows = [
  tender("std-newest", {
    publishedAt: "2026-06-09T00:00:00.000Z",
    deadline: "2026-07-20T00:00:00.000Z",
    budgetMinorUnits: 900_000,
  }),
  tender("vip-oldest", {
    ownerIsVip: true,
    publishedAt: "2026-05-01T00:00:00.000Z",
    deadline: "2026-07-30T00:00:00.000Z",
    budgetMinorUnits: 10_000,
  }),
  tender("std-closing", {
    publishedAt: "2026-06-05T00:00:00.000Z",
    deadline: "2026-06-15T00:00:00.000Z",
    budgetMinorUnits: 500_000,
  }),
];

describe("sortTenders", () => {
  it.each(DISCOVERY_SORTS)(
    "puts VIP-owned tenders first under the %s sort",
    (sort: DiscoverySort) => {
      const sorted = sortTenders(rows, sort);

      expect(sorted[0]?.id).toBe("vip-oldest");
    },
  );

  it("keeps each sort's own order inside the VIP and standard groups", () => {
    const more = [
      ...rows,
      tender("vip-newer", {
        ownerIsVip: true,
        publishedAt: "2026-06-08T00:00:00.000Z",
      }),
    ];

    expect(sortTenders(more, "newest").map((row) => row.id)).toEqual([
      "vip-newer",
      "vip-oldest",
      "std-newest",
      "std-closing",
    ]);
  });

  it("orders the closing sort by deadline inside each group", () => {
    expect(sortTenders(rows, "closing").map((row) => row.id)).toEqual([
      "vip-oldest",
      "std-closing",
      "std-newest",
    ]);
  });

  it("orders the budget sort by amount inside each group", () => {
    expect(sortTenders(rows, "budget").map((row) => row.id)).toEqual([
      "vip-oldest",
      "std-newest",
      "std-closing",
    ]);
  });

  it("does not reorder the input array", () => {
    const input = [...rows];
    sortTenders(input, "closing");
    expect(input.map((row) => row.id)).toEqual(rows.map((row) => row.id));
  });
});

describe("paginateTenders after VIP-first sorting", () => {
  it("keeps VIP tenders on page one and reports the full total", () => {
    const many = Array.from({ length: 7 }, (_, index) =>
      tender(`std-${index}`, {
        publishedAt: `2026-06-0${index + 1}T00:00:00.000Z`,
      }),
    );
    const sorted = sortTenders(
      [...many, tender("vip", { ownerIsVip: true })],
      "newest",
    );

    const page = paginateTenders(sorted, {
      sort: "newest",
      page: 1,
      pageSize: 5,
    });

    expect(page.total).toBe(8);
    expect(page.pageCount).toBe(2);
    expect(page.items[0]?.id).toBe("vip");
    expect(page.items).toHaveLength(5);
  });
});
