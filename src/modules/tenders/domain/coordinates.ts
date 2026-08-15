export type Coordinates = Readonly<{ latitude: number; longitude: number }>;

const EARTH_RADIUS_KILOMETERS = 6371;

export function coarsenCoordinates(exact: Coordinates): Coordinates {
  return {
    latitude: Math.round(exact.latitude * 100) / 100,
    longitude: Math.round(exact.longitude * 100) / 100,
  };
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function distanceKilometers(a: Coordinates, b: Coordinates): number {
  const deltaLatitude = toRadians(b.latitude - a.latitude);
  const deltaLongitude = toRadians(b.longitude - a.longitude);
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_KILOMETERS * Math.asin(Math.sqrt(haversine));
}
