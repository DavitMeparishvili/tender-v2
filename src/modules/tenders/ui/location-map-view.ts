import type { Coordinates } from "../domain/coordinates";

export type MapPrecision = "PRECISE" | "APPROXIMATE";

export type MapView = Readonly<{ center: Coordinates; zoom: number }>;

const PRECISE_ZOOM = 15;
// One step back from street level so the whole approximate-area circle, not
// just its centre, sits inside the frame.
const APPROXIMATE_ZOOM = 13;
const PLACE_FOCUS_ZOOM = 12;

// Tbilisi anchors the first market's overview. A tender without a point yet
// opens on the country rather than the null island at 0,0.
export const GEORGIA_OVERVIEW: MapView = {
  center: { latitude: 41.7151, longitude: 44.8271 },
  zoom: 7,
};

function isPlaced(coordinates: Coordinates | null): coordinates is Coordinates {
  return (
    coordinates !== null &&
    Number.isFinite(coordinates.latitude) &&
    Number.isFinite(coordinates.longitude)
  );
}

export function resolveMapView(
  coordinates: Coordinates | null,
  precision: MapPrecision,
): MapView {
  if (!isPlaced(coordinates)) return GEORGIA_OVERVIEW;

  return {
    center: {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    },
    zoom: precision === "APPROXIMATE" ? APPROXIMATE_ZOOM : PRECISE_ZOOM,
  };
}

export function resolveInteractiveMapView(
  coordinates: Coordinates | null,
  focusCoordinates: Coordinates | null,
  precision: MapPrecision,
): MapView {
  if (isPlaced(coordinates)) return resolveMapView(coordinates, precision);
  if (!isPlaced(focusCoordinates)) return GEORGIA_OVERVIEW;
  return {
    center: focusCoordinates,
    zoom: PLACE_FOCUS_ZOOM,
  };
}
