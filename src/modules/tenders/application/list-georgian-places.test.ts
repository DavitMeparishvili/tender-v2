import { describe, expect, it } from "vitest";
import type { GeorgianPlace } from "../domain/georgian-place";
import { createListGeorgianPlaces } from "./list-georgian-places";

const tbilisi: GeorgianPlace = {
  id: 611717,
  nameEn: "Tbilisi",
  nameKa: "თბილისი",
  kind: "CAPITAL",
  latitude: 41.69143,
  longitude: 44.83412,
  population: 1_049_498,
  admin1Code: "51",
};

describe("createListGeorgianPlaces", () => {
  it("uses Georgian as the primary label in the Georgian interface", async () => {
    const list = createListGeorgianPlaces({
      listActive: async () => [tbilisi],
    });

    await expect(list("ka")).resolves.toEqual([
      expect.objectContaining({
        label: "თბილისი",
        secondaryLabel: "Tbilisi",
        regionLabel: "თბილისი",
      }),
    ]);
  });

  it("uses English as the primary label in the English interface", async () => {
    const list = createListGeorgianPlaces({
      listActive: async () => [tbilisi],
    });

    await expect(list("en")).resolves.toEqual([
      expect.objectContaining({
        label: "Tbilisi",
        secondaryLabel: "თბილისი",
        regionLabel: "Tbilisi",
      }),
    ]);
  });
});
