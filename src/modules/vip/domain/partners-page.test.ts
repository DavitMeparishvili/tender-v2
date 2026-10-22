import { describe, expect, it } from "vitest";
import {
  categoryOptions,
  parseSpecialtyParam,
  partnersPath,
  type PartnerCategoryCounts,
} from "./partners-page";

const counts: PartnerCategoryCounts = {
  total: 8,
  bySpecialty: {
    CONSTRUCTION_REPAIR: 3,
    TRANSPORT: 1,
    EQUIPMENT: 1,
    DAILY_LABOR: 0,
    MATERIAL_SUPPLIER: 3,
  },
};

describe("parseSpecialtyParam", () => {
  it("accepts each known category code", () => {
    expect(parseSpecialtyParam("MATERIAL_SUPPLIER")).toBe("MATERIAL_SUPPLIER");
    expect(parseSpecialtyParam("DAILY_LABOR")).toBe("DAILY_LABOR");
  });

  it("treats unknown, empty, missing and repeated values as no filter", () => {
    expect(parseSpecialtyParam("BOGUS")).toBeNull();
    expect(parseSpecialtyParam("material_supplier")).toBeNull();
    expect(parseSpecialtyParam("")).toBeNull();
    expect(parseSpecialtyParam(undefined)).toBeNull();
    expect(parseSpecialtyParam(["TRANSPORT", "EQUIPMENT"])).toBeNull();
  });
});

describe("partnersPath", () => {
  it("keeps the locale and adds the category only when filtered", () => {
    expect(partnersPath("ka", null)).toBe("/ka/partners");
    expect(partnersPath("ru", "TRANSPORT")).toBe(
      "/ru/partners?specialty=TRANSPORT",
    );
  });
});

describe("categoryOptions", () => {
  it("lists All first, then every category in Discover order", () => {
    const options = categoryOptions(counts, null);

    expect(options.map((option) => option.specialty)).toEqual([
      null,
      "CONSTRUCTION_REPAIR",
      "TRANSPORT",
      "EQUIPMENT",
      "DAILY_LABOR",
      "MATERIAL_SUPPLIER",
    ]);
    expect(options[0]).toMatchObject({
      count: 8,
      selected: true,
      empty: false,
    });
  });

  it("marks exactly the selected category and flags zero-count categories", () => {
    const options = categoryOptions(counts, "TRANSPORT");

    expect(
      options
        .filter((option) => option.selected)
        .map((option) => option.specialty),
    ).toEqual(["TRANSPORT"]);
    expect(
      options.find((option) => option.specialty === "DAILY_LABOR"),
    ).toMatchObject({ count: 0, empty: true, selected: false });
    expect(
      options
        .filter((option) => option.empty)
        .map((option) => option.specialty),
    ).toEqual(["DAILY_LABOR"]);
  });

  it("flags All as empty only when no partner qualifies", () => {
    const options = categoryOptions(
      { total: 0, bySpecialty: counts.bySpecialty },
      null,
    );
    expect(options[0]?.empty).toBe(true);
  });
});
