import { describe, expect, it } from "vitest";
import { coarsenCoordinates, distanceKilometers } from "./coordinates";

describe("coarsenCoordinates", () => {
  it("rounds to two decimal places (~1.1km grid)", () => {
    expect(
      coarsenCoordinates({ latitude: 41.715138, longitude: 44.827096 }),
    ).toEqual({
      latitude: 41.72,
      longitude: 44.83,
    });
  });

  it("never returns the exact input for a fractional coordinate", () => {
    const exact = { latitude: 41.715138, longitude: 44.827096 };
    expect(coarsenCoordinates(exact)).not.toEqual(exact);
  });
});

describe("distanceKilometers", () => {
  it("returns ~0 for the same point", () => {
    const point = { latitude: 41.7151, longitude: 44.8271 };
    expect(distanceKilometers(point, point)).toBeCloseTo(0, 3);
  });

  it("returns the known great-circle distance between Tbilisi and Batumi", () => {
    const tbilisi = { latitude: 41.7151, longitude: 44.8271 };
    const batumi = { latitude: 41.6168, longitude: 41.6367 };
    expect(distanceKilometers(tbilisi, batumi)).toBeCloseTo(265, -1);
  });
});
