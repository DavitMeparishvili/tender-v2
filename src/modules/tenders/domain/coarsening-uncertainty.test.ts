import { describe, expect, it } from "vitest";
import { coarsenCoordinates, distanceKilometers } from "./coordinates";
import { coarseningUncertaintyMeters } from "./coarsening-uncertainty";

describe("coarseningUncertaintyMeters", () => {
  it("covers the worst-case error the two-decimal coarsening can introduce", () => {
    // The coarsened point a provider receives may sit up to half a step away on
    // each axis, so the honest radius is that box's diagonal.
    const latitude = 41.7151;
    const worstCase = {
      latitude: latitude + 0.005,
      longitude: 44.8271 + 0.005,
    };
    const coarsened = coarsenCoordinates({ latitude, longitude: 44.8271 });
    const actualErrorMeters = distanceKilometers(coarsened, worstCase) * 1000;

    expect(coarseningUncertaintyMeters(latitude)).toBeGreaterThanOrEqual(
      actualErrorMeters,
    );
  });

  it("stays close enough to the real error to avoid implying a larger unknown", () => {
    expect(coarseningUncertaintyMeters(41.7151)).toBeLessThan(800);
    expect(coarseningUncertaintyMeters(41.7151)).toBeGreaterThan(600);
  });

  it("narrows toward the poles as longitude degrees shorten", () => {
    expect(coarseningUncertaintyMeters(60)).toBeLessThan(
      coarseningUncertaintyMeters(0),
    );
  });

  it("never returns a radius small enough to imply a precise point", () => {
    for (const latitude of [0, 41.7, 60, 85, -41.7]) {
      expect(coarseningUncertaintyMeters(latitude)).toBeGreaterThan(500);
    }
  });
});
