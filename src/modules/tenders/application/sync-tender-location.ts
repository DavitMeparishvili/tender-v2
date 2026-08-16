import { z } from "zod";
import type { Result } from "@/src/modules/shared";
import { coarsenCoordinates } from "../domain/coordinates";
import type { TenderDraft, TenderLocation } from "../domain/tender";
import type { Geocoder } from "../ports/geocoder";
import type { TenderActor } from "./create-tender-draft";
import type { TenderMutationError } from "./update-tender-draft";

const addressInputSchema = z.object({
  mode: z.literal("ADDRESS"),
  placeId: z.number().int().positive().optional(),
  city: z.string().trim().min(2).max(120),
  district: z.string().trim().min(1).max(120).nullable().optional(),
  addressLine: z.string().trim().min(3).max(240),
});
const pinInputSchema = z.object({
  mode: z.literal("PIN"),
  placeId: z.number().int().positive().optional(),
  city: z.string().trim().min(2).max(120),
  district: z.string().trim().min(1).max(120).nullable().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export const syncTenderLocationCommandSchema = z.discriminatedUnion("mode", [
  addressInputSchema,
  pinInputSchema,
]);
export type SyncTenderLocationCommand = z.output<
  typeof syncTenderLocationCommandSchema
>;
export type SyncLocationError =
  TenderMutationError | "ADDRESS_NOT_FOUND" | "COORDINATES_NOT_FOUND";

export interface SyncTenderLocationRepository {
  updateLocation(
    id: string,
    location: TenderLocation,
    actor: TenderActor,
  ): Promise<Result<TenderDraft, TenderMutationError>>;
}

export function createSyncTenderLocation(dependencies: {
  repository: SyncTenderLocationRepository;
  geocoder: Geocoder;
}) {
  return async function syncTenderLocation(
    id: string,
    input: unknown,
    actor: TenderActor,
  ): Promise<Result<TenderDraft, SyncLocationError | "INVALID_INPUT">> {
    const parsed = syncTenderLocationCommandSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

    const resolved =
      parsed.data.mode === "ADDRESS"
        ? await dependencies.geocoder.geocode({
            countryCode: "GE",
            ...(parsed.data.placeId ? { placeId: parsed.data.placeId } : {}),
            city: parsed.data.city,
            addressLine: parsed.data.addressLine,
          })
        : await dependencies.geocoder.reverseGeocode(
            {
              latitude: parsed.data.latitude,
              longitude: parsed.data.longitude,
            },
            {
              ...(parsed.data.placeId ? { placeId: parsed.data.placeId } : {}),
              city: parsed.data.city,
            },
          );
    if (!resolved.ok) return resolved;

    const exact =
      parsed.data.mode === "PIN"
        ? { latitude: parsed.data.latitude, longitude: parsed.data.longitude }
        : {
            latitude: resolved.value.latitude,
            longitude: resolved.value.longitude,
          };

    const location: TenderLocation = {
      countryCode: "GE",
      // Persisted so that resuming this draft reopens step 3 in the mode the
      // client used, and so the wizard re-submits the same kind of command
      // instead of overwriting the address with a reverse-geocoded label (or
      // the pin with a city centroid).
      mode: parsed.data.mode,
      placeId: resolved.value.placeId ?? parsed.data.placeId ?? null,
      city: resolved.value.city ?? parsed.data.city,
      district: parsed.data.district ?? null,
      addressLine:
        parsed.data.mode === "ADDRESS"
          ? parsed.data.addressLine
          : resolved.value.normalizedAddress,
      exact,
      public: coarsenCoordinates(exact),
    };

    return dependencies.repository.updateLocation(id, location, actor);
  };
}

export async function syncTenderLocation(
  id: string,
  input: unknown,
  actor: TenderActor,
): Promise<Result<TenderDraft, SyncLocationError | "INVALID_INPUT">> {
  const [{ prismaTenderRepository }, { prismaGeorgianPlaceCatalog }] =
    await Promise.all([
      import("../infrastructure/prisma-tender-repository"),
      import("../infrastructure/prisma-georgian-place-catalog"),
    ]);
  return createSyncTenderLocation({
    repository: prismaTenderRepository,
    geocoder: prismaGeorgianPlaceCatalog,
  })(id, input, actor);
}
