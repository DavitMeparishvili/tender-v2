import { describe, expect, it } from "vitest";
import {
  TENDER_SERVICES,
  TENDER_SPECIALTIES,
  isServiceForSpecialty,
  isTenderServiceCode,
  servicesForSpecialty,
} from "./service-taxonomy";

describe("tender service taxonomy", () => {
  it("covers every product category with a substantial, unique service list", () => {
    expect(TENDER_SPECIALTIES).toEqual([
      "CONSTRUCTION_REPAIR",
      "TRANSPORT",
      "EQUIPMENT",
      "DAILY_LABOR",
      "MATERIAL_SUPPLIER",
    ]);
    expect(TENDER_SERVICES.length).toBeGreaterThanOrEqual(70);
    expect(new Set(TENDER_SERVICES.map(({ code }) => code)).size).toBe(
      TENDER_SERVICES.length,
    );
    for (const specialty of TENDER_SPECIALTIES) {
      expect(servicesForSpecialty(specialty).length).toBeGreaterThanOrEqual(8);
    }
  });

  it("keeps precise services inside their owning category", () => {
    expect(isTenderServiceCode("PAINTING_DECORATING")).toBe(true);
    expect(
      isServiceForSpecialty("PAINTING_DECORATING", "CONSTRUCTION_REPAIR"),
    ).toBe(true);
    expect(isServiceForSpecialty("PAINTING_DECORATING", "TRANSPORT")).toBe(
      false,
    );
  });
});
