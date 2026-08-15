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
