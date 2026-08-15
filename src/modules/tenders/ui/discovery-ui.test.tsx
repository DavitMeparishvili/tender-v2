import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../../localization/messages/en.json";
import ka from "../../localization/messages/ka.json";
import type {
  PublicTenderDetail,
  PublicTenderSummary,
} from "../domain/masking";
import { DiscoveryDetailContent } from "./discovery-detail";
import { DiscoveryListContent } from "./discovery-list";
import {
  majorUnitsToMinorUnits,
  MAX_DISCOVERY_BUDGET_MINOR_UNITS,
  parseDiscoverySearchParams,
  serializeDiscoveryFilters,
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
      deadlineBefore: "2026-09-01",
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toMatchObject({
      specialty: "CONSTRUCTION_REPAIR",
      city: "Tbilisi",
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
    [{ minBudget: "1.234" }, ["minBudget"]],
    [{ minBudget: "20", maxBudget: "10" }, ["minBudget", "maxBudget"]],
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

  it("serializes filters deterministically while preserving unrelated params", () => {
    const href = serializeDiscoveryFilters(
      "/en/provider/tenders",
      new URLSearchParams("page=2&city=Old&minBudget=9"),
      {
        specialty: "CONSTRUCTION_REPAIR",
        city: " Tbilisi & Vake ",
        minBudget: "100.25",
        maxBudget: "500",
        deadlineBefore: "2026-09-01",
      },
    );

    expect(href).toBe(
      "/en/provider/tenders?page=2&specialty=CONSTRUCTION_REPAIR&city=Tbilisi+%26+Vake&minBudget=100.25&maxBudget=500&deadlineBefore=2026-09-01",
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
          deadlineBefore: "",
        },
      ),
    ).toBe("/ka/provider/tenders");
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
