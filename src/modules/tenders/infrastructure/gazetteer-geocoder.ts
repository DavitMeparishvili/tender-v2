import { distanceKilometers, type Coordinates } from "../domain/coordinates";
import type { Geocoder, GeocodeQuery, GeocodeResult } from "../ports/geocoder";

const GEORGIAN_CITIES: ReadonlyArray<
  Readonly<{ name: string; latitude: number; longitude: number }>
> = [
  { name: "Tbilisi", latitude: 41.7151, longitude: 44.8271 },
  { name: "Batumi", latitude: 41.6168, longitude: 41.6367 },
  { name: "Kutaisi", latitude: 42.2679, longitude: 42.6946 },
  { name: "Rustavi", latitude: 41.5492, longitude: 45.0006 },
  { name: "Gori", latitude: 41.9847, longitude: 44.1116 },
  { name: "Zugdidi", latitude: 42.5088, longitude: 41.8709 },
];

// 150 km comfortably covers Georgian territory from the six gazetteer cities
// (the farthest inhabited corners — Kakheti in the east, Kazbegi in the
// north, Svaneti in the northwest — are all within ~120 km of a listed city)
// while rejecting neighbouring-country pins such as Yerevan (~173 km from
// Tbilisi). It fails in the safe direction: a rejected pin falls back to the
// address form.
const MAX_PIN_DISTANCE_FROM_GAZETTEER_KILOMETERS = 150;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export class GazetteerGeocoder implements Geocoder {
  async geocode(query: GeocodeQuery): ReturnType<Geocoder["geocode"]> {
    const match = GEORGIAN_CITIES.find(
      (city) => normalize(city.name) === normalize(query.city),
    );
    if (!match) return { ok: false, error: "ADDRESS_NOT_FOUND" };

    return {
      ok: true,
      value: {
        latitude: match.latitude,
        longitude: match.longitude,
        normalizedAddress: `${query.addressLine}, ${match.name}, Georgia`,
      },
    };
  }

  async reverseGeocode(
    coordinates: Coordinates,
  ): ReturnType<Geocoder["reverseGeocode"]> {
    let nearest: {
      city: (typeof GEORGIAN_CITIES)[number];
      distance: number;
    } | null = null;
    for (const city of GEORGIAN_CITIES) {
      const distance = distanceKilometers(coordinates, city);
      if (nearest === null || distance < nearest.distance) {
        nearest = { city, distance };
      }
    }
    if (
      nearest === null ||
      nearest.distance > MAX_PIN_DISTANCE_FROM_GAZETTEER_KILOMETERS
    ) {
      return { ok: false, error: "COORDINATES_NOT_FOUND" };
    }

    const result: GeocodeResult = {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      normalizedAddress: `Near ${nearest.city.name}, Georgia`,
    };
    return { ok: true, value: result };
  }
}

export const gazetteerGeocoder = new GazetteerGeocoder();
