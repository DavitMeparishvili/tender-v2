import { describe, expect, it } from "vitest";
import { PrismaGeorgianPlaceCatalog } from "./prisma-georgian-place-catalog";

describe("PrismaGeorgianPlaceCatalog", () => {
  const catalog = new PrismaGeorgianPlaceCatalog();

  it("loads the seeded Georgian place catalog", async () => {
    const places = await catalog.listActive();

    expect(places).toHaveLength(224);
    expect(places).toContainEqual(
      expect.objectContaining({
        id: 611717,
        nameEn: "Tbilisi",
        nameKa: "თბილისი",
        kind: "CAPITAL",
      }),
    );
  });

  it("geocodes a selected place by its stable catalog id", async () => {
    const result = await catalog.geocode({
      countryCode: "GE",
      placeId: 611694,
      city: "Telavi",
      addressLine: "1 Erekle II Street",
    });

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        placeId: 611694,
        city: "Telavi",
        latitude: expect.closeTo(41.91957, 4),
        longitude: expect.closeTo(45.47002, 4),
      }),
    });
  });

  it("keeps the selected place when a pin is nearby", async () => {
    const result = await catalog.reverseGeocode(
      { latitude: 41.7333, longitude: 44.7912 },
      { placeId: 611717, city: "Tbilisi" },
    );

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        placeId: 611717,
        city: "Tbilisi",
        normalizedAddress: "Near Tbilisi, Georgia",
      }),
    });
  });
});
