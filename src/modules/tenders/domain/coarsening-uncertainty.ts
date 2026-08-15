// `coarsenCoordinates` rounds to two decimal places, so a coarsened point can
// sit up to half a step away from the exact point on each axis.
const COARSENING_HALF_STEP_DEGREES = 0.005;
const METERS_PER_DEGREE_LATITUDE = 111_320;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// The radius an approximate-area circle must span to remain truthful: the
// diagonal of the worst-case error box. Longitude degrees shorten toward the
// poles, so the radius is latitude-dependent rather than a fixed constant.
// Returning anything smaller would draw false precision around a masked tender.
export function coarseningUncertaintyMeters(latitude: number): number {
  const latitudeMeters =
    COARSENING_HALF_STEP_DEGREES * METERS_PER_DEGREE_LATITUDE;
  const longitudeMeters = latitudeMeters * Math.cos(toRadians(latitude));

  return Math.hypot(latitudeMeters, longitudeMeters);
}
