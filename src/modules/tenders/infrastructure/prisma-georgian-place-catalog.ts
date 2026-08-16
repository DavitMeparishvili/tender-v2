import { database } from "../../../infrastructure/db/client";
import type { GeorgianPlaceCatalog } from "../application/list-georgian-places";
import { distanceKilometers, type Coordinates } from "../domain/coordinates";
import type { GeorgianPlace } from "../domain/georgian-place";
import type {
  Geocoder,
  GeocodeQuery,
  GeocodeResult,
  ReverseGeocodeContext,
} from "../ports/geocoder";

const MAX_NEAREST_PLACE_DISTANCE_KILOMETERS = 75;

function toPlace(row: {
  id: number;
  nameEn: string;
  nameKa: string;
  kind: GeorgianPlace["kind"];
  latitude: number;
  longitude: number;
  population: number;
  admin1Code: string | null;
}): GeorgianPlace {
  return row;
}

function geocodeResult(
  place: GeorgianPlace,
  normalizedAddress: string,
): GeocodeResult {
  return {
    placeId: place.id,
    city: place.nameEn,
    latitude: place.latitude,
    longitude: place.longitude,
    normalizedAddress,
  };
}

export class PrismaGeorgianPlaceCatalog
  implements GeorgianPlaceCatalog, Geocoder
{
  async listActive(): Promise<readonly GeorgianPlace[]> {
    const rows = await database.georgianPlace.findMany({
      where: { isActive: true },
      orderBy: [
        { kind: "asc" },
        { population: "desc" },
        { nameEn: "asc" },
        { id: "asc" },
      ],
      select: {
        id: true,
        nameEn: true,
        nameKa: true,
        kind: true,
        latitude: true,
        longitude: true,
        population: true,
        admin1Code: true,
      },
    });
    return rows.map(toPlace);
  }

  async geocode(query: GeocodeQuery): ReturnType<Geocoder["geocode"]> {
    const place = query.placeId
      ? await database.georgianPlace.findFirst({
          where: { id: query.placeId, isActive: true },
        })
      : await database.georgianPlace.findFirst({
          where: {
            isActive: true,
            OR: [
              { nameEn: { equals: query.city, mode: "insensitive" } },
              { nameKa: { equals: query.city, mode: "insensitive" } },
            ],
          },
          orderBy: [{ population: "desc" }, { id: "asc" }],
        });
    if (place === null) return { ok: false, error: "ADDRESS_NOT_FOUND" };

    return {
      ok: true,
      value: geocodeResult(
        toPlace(place),
        `${query.addressLine}, ${place.nameEn}, Georgia`,
      ),
    };
  }

  async reverseGeocode(
    coordinates: Coordinates,
    context?: ReverseGeocodeContext,
  ): ReturnType<Geocoder["reverseGeocode"]> {
    const requestedPlace =
      context?.placeId || context?.city
        ? await database.georgianPlace.findFirst({
            where: {
              isActive: true,
              ...(context.placeId
                ? { id: context.placeId }
                : context.city
                  ? {
                      OR: [
                        {
                          nameEn: {
                            equals: context.city,
                            mode: "insensitive",
                          },
                        },
                        {
                          nameKa: {
                            equals: context.city,
                            mode: "insensitive",
                          },
                        },
                      ],
                    }
                  : {}),
            },
            orderBy: [{ population: "desc" }, { id: "asc" }],
          })
        : null;
    if (
      requestedPlace &&
      distanceKilometers(coordinates, requestedPlace) <=
        MAX_NEAREST_PLACE_DISTANCE_KILOMETERS
    ) {
      return {
        ok: true,
        value: {
          ...geocodeResult(
            toPlace(requestedPlace),
            `Near ${requestedPlace.nameEn}, Georgia`,
          ),
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        },
      };
    }

    const places = await this.listActive();
    let nearest: { place: GeorgianPlace; distance: number } | null = null;
    for (const place of places) {
      const distance = distanceKilometers(coordinates, place);
      if (nearest === null || distance < nearest.distance) {
        nearest = { place, distance };
      }
    }
    if (
      nearest === null ||
      nearest.distance > MAX_NEAREST_PLACE_DISTANCE_KILOMETERS
    ) {
      return { ok: false, error: "COORDINATES_NOT_FOUND" };
    }

    return {
      ok: true,
      value: {
        ...geocodeResult(
          nearest.place,
          `Near ${nearest.place.nameEn}, Georgia`,
        ),
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      },
    };
  }
}

export const prismaGeorgianPlaceCatalog = new PrismaGeorgianPlaceCatalog();
