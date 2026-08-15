import { describe, expect, it } from "vitest";
import { GEORGIA_OVERVIEW, resolveMapView } from "./location-map-view";

describe("resolveMapView", () => {
  it("frames a placed pin at street level", () => {
    expect(
      resolveMapView({ latitude: 41.7151, longitude: 44.8271 }, "PRECISE"),
    ).toEqual({ center: { latitude: 41.7151, longitude: 44.8271 }, zoom: 15 });
  });

  it("pulls back for an approximate area so the whole circle is visible", () => {
    const view = resolveMapView(
      { latitude: 41.72, longitude: 44.83 },
      "APPROXIMATE",
    );

    expect(view.center).toEqual({ latitude: 41.72, longitude: 44.83 });
    expect(view.zoom).toBeLessThan(15);
  });

  it("falls back to a country overview when no point has been chosen", () => {
    expect(resolveMapView(null, "PRECISE")).toEqual(GEORGIA_OVERVIEW);
  });

  it("rejects a partial or non-finite coordinate pair rather than centring on zero", () => {
    expect(
      resolveMapView({ latitude: 41.7, longitude: NaN }, "PRECISE"),
    ).toEqual(GEORGIA_OVERVIEW);
    expect(
      resolveMapView(
        { latitude: Number.POSITIVE_INFINITY, longitude: 44.8 },
        "PRECISE",
      ),
    ).toEqual(GEORGIA_OVERVIEW);
  });
});

describe("GEORGIA_OVERVIEW", () => {
  it("sits inside the country the first market serves", () => {
    expect(GEORGIA_OVERVIEW.center.latitude).toBeGreaterThan(41);
    expect(GEORGIA_OVERVIEW.center.latitude).toBeLessThan(44);
    expect(GEORGIA_OVERVIEW.center.longitude).toBeGreaterThan(40);
    expect(GEORGIA_OVERVIEW.center.longitude).toBeLessThan(47);
  });
});
