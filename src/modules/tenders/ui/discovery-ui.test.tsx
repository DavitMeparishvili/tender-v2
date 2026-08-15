import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../../localization/messages/en.json";
import ka from "../../localization/messages/ka.json";
import type {
  PublicTenderDetail,
  PublicTenderSummary,
} from "../domain/masking";
import { DiscoveryDetailContent } from "./discovery-detail";
import { discoveryFilterIssues } from "./discovery-filters";
import { DiscoveryListContent } from "./discovery-list";
import {
  majorUnitsToMinorUnits,
  MAX_DISCOVERY_BUDGET_MINOR_UNITS,
  parseDiscoverySearchParams,
  serializeDiscoveryFilters,
  type DiscoveryFilterKey,
} from "./discovery-query";

const publicTender: PublicTenderDetail = {
  id: "public-tender-1",
  title: "Repaint two bedrooms",
  shortDescription: "Prepare and repaint two bedrooms.",
  specialty: "CONSTRUCTION_REPAIR",
  budgetMinorUnits: 123_456,
  currency: "GEL",
  city: "Tbilisi",
  district: "Vake",
  publicLatitude: 41.7,
  publicLongitude: 44.8,
  publishedAt: "2026-08-15T12:00:00.000Z",
  deadline: "2026-08-31T12:00:00.000Z",
  fullDescription:
    "Protect the floors, prepare the walls, and apply two coats.",
  scopeOfWork: "Two bedrooms with minor wall repairs.",
  workerNotes: "Two painters preferred.",
  equipmentNotes: "Bring ladders.",
  materialNotes: "Low-VOC paint required.",
  desiredStartDate: "2026-09-02T08:00:00.000Z",
};

const sensitiveSentinels = [
  "owner-secret-sentinel",
  "41.712345",
  "44.754321",
  "1 Private Avenue",
  "private@example.test",
  "internal-object-key",
  "private conditions sentinel",
] as const;

// The exact coordinates the seeded fixtures elsewhere in this suite use as
// the "never render this" location. A fixed-string sentinel like
// `not.toContain("41.7151")` only catches a leak that happens to be
// formatted exactly that way; `formatCoordinate` in discovery-detail.tsx
// renders through `Intl.NumberFormat` with `maximumFractionDigits: 3` and a
// locale-dependent decimal separator, so a real leak would very likely never
// look like the raw fixed string at all. `leaksExactCoordinate` instead
// parses every number-shaped substring out of the rendered HTML — tolerating
// both "." and "," as the decimal separator — and fails if any of them is
// numerically close to an exact coordinate, regardless of how it was
// formatted or rounded.
const EXACT_LEAK_LATITUDE = 41.7151;
const EXACT_LEAK_LONGITUDE = 44.8271;
const EXACT_LEAK_TOLERANCE = 0.001;

function numericTokensIn(html: string): number[] {
  return (html.match(/-?\d+(?:[.,]\d+)?/g) ?? [])
    .map((token) => Number.parseFloat(token.replace(",", ".")))
    .filter((value) => !Number.isNaN(value));
}

function leaksExactCoordinate(html: string): boolean {
  return numericTokensIn(html).some(
    (value) =>
      Math.abs(value - EXACT_LEAK_LATITUDE) < EXACT_LEAK_TOLERANCE ||
      Math.abs(value - EXACT_LEAK_LONGITUDE) < EXACT_LEAK_TOLERANCE,
  );
}

function withSensitiveRuntimeFields<T extends PublicTenderSummary>(value: T) {
  return {
    ...value,
    ownerId: sensitiveSentinels[0],
    exactLatitude: Number(sensitiveSentinels[1]),
    exactLongitude: Number(sensitiveSentinels[2]),
    addressLine: sensitiveSentinels[3],
    contactEmail: sensitiveSentinels[4],
    attachments: [{ objectKey: sensitiveSentinels[5] }],
    conditions: sensitiveSentinels[6],
  };
}

describe("provider discovery query", () => {
  it("converts decimal major units to integer minor units without float drift", () => {
    expect(majorUnitsToMinorUnits("0")).toBe(0);
    expect(majorUnitsToMinorUnits(" 1234.56 ")).toBe(123_456);
    expect(majorUnitsToMinorUnits("12.3")).toBe(1_230);
    expect(majorUnitsToMinorUnits("21474836.47")).toBe(
      MAX_DISCOVERY_BUDGET_MINOR_UNITS,
    );
    expect(majorUnitsToMinorUnits("21474836.48")).toBeNull();
    expect(majorUnitsToMinorUnits("1.234")).toBeNull();
    expect(majorUnitsToMinorUnits("-1")).toBeNull();
  });

  it("parses the supported URL filters into the application query", () => {
    const parsed = parseDiscoverySearchParams({
      specialty: "CONSTRUCTION_REPAIR",
      city: " Tbilisi ",
      minBudget: "100.25",
      maxBudget: "2000",
      currency: "GEL",
      deadlineBefore: "2026-09-01",
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toMatchObject({
      specialty: "CONSTRUCTION_REPAIR",
      city: "Tbilisi",
      currency: "GEL",
      minBudgetMinorUnits: 10_025,
      maxBudgetMinorUnits: 200_000,
    });
    expect(parsed.value.deadlineBefore?.toISOString()).toBe(
      "2026-08-31T20:00:00.000Z",
    );
  });

  it.each([
    [{ city: ["Tbilisi", "Batumi"] }, ["city"]],
    [{ specialty: "PLUMBING" }, ["specialty"]],
    // A currency accompanies every budget case so the assertion isolates the
    // budget fault rather than also tripping the currency requirement.
    [{ minBudget: "1.234", currency: "GEL" }, ["minBudget"]],
    [
      { minBudget: "20", maxBudget: "10", currency: "GEL" },
      ["minBudget", "maxBudget"],
    ],
    [{ deadlineBefore: "2026-02-30" }, ["deadlineBefore"]],
  ] as const)(
    "rejects ambiguous or invalid filters: %o",
    (searchParams, fields) => {
      expect(parseDiscoverySearchParams(searchParams)).toEqual({
        ok: false,
        fields,
      });
    },
  );

  it("passes a chosen currency through so a budget range compares like for like", () => {
    const parsed = parseDiscoverySearchParams({
      minBudget: "20000",
      maxBudget: "90000",
      currency: "USD",
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toMatchObject({
      currency: "USD",
      minBudgetMinorUnits: 2_000_000,
      maxBudgetMinorUnits: 9_000_000,
    });
  });

  it("refuses a budget bound with no currency to compare it against", () => {
    // Budgets are integer minor units in whichever currency the client chose,
    // so an unscoped bound would match a USD tender against a GEL threshold.
    expect(parseDiscoverySearchParams({ minBudget: "20000" })).toEqual({
      ok: false,
      fields: ["currency"],
    });
    expect(parseDiscoverySearchParams({ maxBudget: "90000" })).toEqual({
      ok: false,
      fields: ["currency"],
    });
  });

  it("accepts a currency on its own and rejects one outside the supported set", () => {
    const alone = parseDiscoverySearchParams({ currency: "GEL" });
    expect(alone.ok).toBe(true);
    if (alone.ok) expect(alone.value).toMatchObject({ currency: "GEL" });

    expect(parseDiscoverySearchParams({ currency: "EUR" })).toEqual({
      ok: false,
      fields: ["currency"],
    });
  });

  it("serializes filters deterministically while preserving unrelated params", () => {
    const href = serializeDiscoveryFilters(
      "/en/provider/tenders",
      new URLSearchParams("page=2&city=Old&minBudget=9"),
      {
        specialty: "CONSTRUCTION_REPAIR",
        city: " Tbilisi & Vake ",
        minBudget: "100.25",
        maxBudget: "500",
        currency: "GEL",
        deadlineBefore: "2026-09-01",
      },
    );

    expect(href).toBe(
      "/en/provider/tenders?page=2&specialty=CONSTRUCTION_REPAIR&city=Tbilisi+%26+Vake&minBudget=100.25&maxBudget=500&currency=GEL&deadlineBefore=2026-09-01",
    );
    expect(
      serializeDiscoveryFilters(
        "/ka/provider/tenders",
        new URLSearchParams("city=Old"),
        {
          specialty: "",
          city: "",
          minBudget: "",
          maxBudget: "",
          currency: "",
          deadlineBefore: "",
        },
      ),
    ).toBe("/ka/provider/tenders");
  });
});

describe("provider discovery filter issues", () => {
  const issueCopy = {
    invalidInput: en.tenders.errors.invalidInput,
    invalidBudgetRange: en.tenders.errors.invalidBudgetRange,
    currencyRequired: en.tenders.errors.currencyRequired,
  };

  function fieldsOf(keys: readonly DiscoveryFilterKey[]) {
    return discoveryFilterIssues(new Set(keys), issueCopy).map(
      (issue) => issue.field,
    );
  }

  it("associates a solo invalid maxBudget with the maximum-budget control, not the minimum", () => {
    const issues = discoveryFilterIssues(new Set(["maxBudget"]), issueCopy);
    expect(issues).toEqual([
      { field: "maxBudget", message: en.tenders.errors.invalidBudgetRange },
    ]);
  });

  it("associates a solo invalid minBudget with the minimum-budget control", () => {
    const issues = discoveryFilterIssues(new Set(["minBudget"]), issueCopy);
    expect(issues).toEqual([
      { field: "minBudget", message: en.tenders.errors.invalidBudgetRange },
    ]);
  });

  it("flags both budget controls for a reversed min/max range", () => {
    expect(fieldsOf(["minBudget", "maxBudget"])).toEqual([
      "minBudget",
      "maxBudget",
    ]);
  });

  it("keeps every other filter field's issue independent of the budget fields", () => {
    expect(fieldsOf(["specialty"])).toEqual(["specialty"]);
    expect(fieldsOf(["city"])).toEqual(["city"]);
    expect(fieldsOf(["currency"])).toEqual(["currency"]);
    expect(fieldsOf(["deadlineBefore"])).toEqual(["deadlineBefore"]);
  });
});

describe("provider masked discovery UI", () => {
  it("renders linked semantic summary rows without runtime-sensitive fields", () => {
    const runtimeValue = withSensitiveRuntimeFields(publicTender);
    const html = renderToStaticMarkup(
      <DiscoveryListContent
        locale="en"
        messages={en}
        result={{ ok: true, value: [runtimeValue] }}
      />,
    );

    expect(html).toContain("<ul");
    expect(html).toContain(publicTender.title);
    expect(html).toContain(publicTender.shortDescription);
    expect(html).toContain("GEL");
    expect(html).toContain("Tbilisi, Vake");
    expect(html).toContain('href="/en/provider/tenders/public-tender-1"');
    expect(html).toContain(en.tenders.viewDetail);
    for (const sentinel of sensitiveSentinels) {
      expect(html).not.toContain(sentinel);
    }
  });

  it("renders every masked detail field in Georgian without private sections", () => {
    const runtimeValue = withSensitiveRuntimeFields(publicTender);
    const html = renderToStaticMarkup(
      <DiscoveryDetailContent
        locale="ka"
        messages={ka}
        tender={runtimeValue}
      />,
    );

    for (const value of [
      publicTender.id,
      publicTender.title,
      publicTender.shortDescription,
      publicTender.fullDescription,
      publicTender.scopeOfWork,
      publicTender.workerNotes,
      publicTender.equipmentNotes,
      publicTender.materialNotes,
      publicTender.city,
      publicTender.district,
    ]) {
      expect(html).toContain(value ?? ka.tenders.notProvided);
    }
    expect(html).toContain(ka.tenders.specialtyConstructionRepair);
    expect(html).toContain(ka.tenders.approximateCoordinates);
    expect(html).toContain("41,7; 44,8");
    expect(html).toContain("1234,56");
    for (const sentinel of sensitiveSentinels) {
      expect(html).not.toContain(sentinel);
    }
    expect(html).not.toContain(ka.tenders.addressLine);
    expect(html).not.toContain(ka.tenders.attachments);
    expect(html).not.toContain(ka.tenders.conditions);
  });

  it("gives a provider an approximate-area map and never a precise one", () => {
    const html = renderToStaticMarkup(
      <DiscoveryDetailContent
        locale="en"
        messages={en}
        tender={publicTender}
      />,
    );

    expect(html).toContain('aria-labelledby="map-heading"');
    expect(html).toContain(en.tenders.mapHeading);
    expect(html).toContain(en.tenders.mapApproximateLabel);
    expect(html).not.toContain(en.tenders.mapPreciseLabel);
    expect(html).not.toContain(en.tenders.mapInteractiveLabel);
    expect(html).toContain('data-interactive="false"');
  });

  it("keeps exact coordinates out of the provider map markup", () => {
    // The masked projection has no exact coordinates to leak, so this guards
    // against a future prop change feeding the map an unmasked pair. The
    // assertion tolerates any numeric formatting of the leaked value (see
    // `leaksExactCoordinate` above) rather than one fixed decimal string.
    const html = renderToStaticMarkup(
      <DiscoveryDetailContent
        locale="en"
        messages={en}
        tender={{
          ...publicTender,
          publicLatitude: 41.7,
          publicLongitude: 44.8,
        }}
      />,
    );

    expect(leaksExactCoordinate(html)).toBe(false);
  });

  it("catches an exact-coordinate leak formatted in a way a fixed-string sentinel would miss", () => {
    // Proves the new assertion actually does its job: render the exact
    // coordinate the way the real `formatCoordinate` helper would (Georgian
    // locale, comma decimal separator, rounded to 3 fraction digits) rather
    // than as the raw "41.7151" string. The old fixed-string sentinel would
    // have let this through unnoticed.
    const leakedHtml = `<dd>${new Intl.NumberFormat("ka", {
      maximumFractionDigits: 3,
    }).format(EXACT_LEAK_LATITUDE)}</dd>`;

    expect(leakedHtml).not.toContain("41.7151");
    expect(leaksExactCoordinate(leakedHtml)).toBe(true);
  });

  it("renders localized empty and invalid-filter states", () => {
    const empty = renderToStaticMarkup(
      <DiscoveryListContent
        locale="en"
        messages={en}
        result={{ ok: true, value: [] }}
      />,
    );
    const invalid = renderToStaticMarkup(
      <DiscoveryListContent locale="en" messages={en} result={{ ok: false }} />,
    );

    expect(empty).toContain(en.tenders.providerListEmpty);
    expect(empty).not.toContain("<ul");
    expect(invalid).toContain('role="alert"');
    expect(invalid).toContain(en.tenders.errors.invalidInput);
  });
});
