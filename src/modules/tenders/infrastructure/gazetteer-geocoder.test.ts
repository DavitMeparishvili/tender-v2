import { describe, expect, it } from "vitest";
import { GazetteerGeocoder } from "./gazetteer-geocoder";

const geocoder = new GazetteerGeocoder();

describe("GazetteerGeocoder", () => {
  it("geocodes a known city case-insensitively", async () => {
    const result = await geocoder.geocode({
      countryCode: "GE",
      city: "tbilisi",
      addressLine: "1 Chavchavadze Ave",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.latitude).toBeCloseTo(41.7151, 1);
      expect(result.value.longitude).toBeCloseTo(44.8271, 1);
    }
  });

  // ka is the primary locale of the first market, so a client typing their own
  // city in their own script must reach the same gazetteer entry as the Latin
  // spelling — same coordinates, no ADDRESS_NOT_FOUND.
  it.each([
    ["თბილისი", 41.7151, 44.8271],
    ["ბათუმი", 41.6168, 41.6367],
    ["ქუთაისი", 42.2679, 42.6946],
    ["რუსთავი", 41.5492, 45.0006],
    ["გორი", 41.9847, 44.1116],
    ["ზუგდიდი", 42.5088, 41.8709],
  ])(
    "geocodes %s from its Georgian spelling",
    async (city, latitude, longitude) => {
      const result = await geocoder.geocode({
        countryCode: "GE",
        city,
        addressLine: "12 რუსთაველის გამზირი",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.latitude).toBeCloseTo(latitude, 4);
        expect(result.value.longitude).toBeCloseTo(longitude, 4);
      }
    },
  );

  it("matches a Georgian city name ignoring case and surrounding space", async () => {
    const result = await geocoder.geocode({
      countryCode: "GE",
      // Mtavruli (Georgian upper case) with padding: matching must survive both.
      city: "  ᲗᲑᲘᲚᲘᲡᲘ  ",
      addressLine: "1 Chavchavadze Ave",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.latitude).toBeCloseTo(41.7151, 4);
  });

  it("returns ADDRESS_NOT_FOUND for an unknown city", async () => {
    const result = await geocoder.geocode({
      countryCode: "GE",
      city: "Nonexistentville",
      addressLine: "1 Main St",
    });
    expect(result).toEqual({ ok: false, error: "ADDRESS_NOT_FOUND" });
  });

  it("reverse-geocodes to the nearest gazetteer city", async () => {
    const result = await geocoder.reverseGeocode({
      latitude: 41.72,
      longitude: 44.83,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.normalizedAddress).toContain("Tbilisi");
  });

  it("returns COORDINATES_NOT_FOUND for a pin far outside Georgia", async () => {
    // Mid-Atlantic Ocean: thousands of km from any gazetteer city.
    const result = await geocoder.reverseGeocode({
      latitude: 0,
      longitude: -30,
    });
    expect(result).toEqual({ ok: false, error: "COORDINATES_NOT_FOUND" });
  });
});
