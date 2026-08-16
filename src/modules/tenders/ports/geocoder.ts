import type { Result } from "@/src/modules/shared";
import type { Coordinates } from "../domain/coordinates";

export type GeocodeQuery = Readonly<{
  countryCode: "GE";
  placeId?: number;
  city: string;
  addressLine: string;
}>;

export type GeocodeResult = Readonly<{
  placeId?: number;
  city?: string;
  latitude: number;
  longitude: number;
  normalizedAddress: string;
}>;

export type ReverseGeocodeContext = Readonly<{
  placeId?: number;
  city?: string;
}>;

export interface Geocoder {
  geocode(
    query: GeocodeQuery,
  ): Promise<Result<GeocodeResult, "ADDRESS_NOT_FOUND">>;
  reverseGeocode(
    coordinates: Coordinates,
    context?: ReverseGeocodeContext,
  ): Promise<Result<GeocodeResult, "COORDINATES_NOT_FOUND">>;
}
