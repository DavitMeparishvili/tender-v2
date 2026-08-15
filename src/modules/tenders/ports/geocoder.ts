import type { Result } from "@/src/modules/shared";
import type { Coordinates } from "../domain/coordinates";

export type GeocodeQuery = Readonly<{
  countryCode: "GE";
  city: string;
  addressLine: string;
}>;

export type GeocodeResult = Readonly<{
  latitude: number;
  longitude: number;
  normalizedAddress: string;
}>;

export interface Geocoder {
  geocode(
    query: GeocodeQuery,
  ): Promise<Result<GeocodeResult, "ADDRESS_NOT_FOUND">>;
  reverseGeocode(
    coordinates: Coordinates,
  ): Promise<Result<GeocodeResult, "COORDINATES_NOT_FOUND">>;
}
