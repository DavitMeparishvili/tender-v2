import { describe, expect, it } from "vitest";
import type { TenderDraft, TenderLocation } from "../domain/tender";
import type { Geocoder } from "../ports/geocoder";
import type { TenderActor } from "./create-tender-draft";
import {
  createSyncTenderLocation,
  type SyncTenderLocationRepository,
} from "./sync-tender-location";

const actor: TenderActor = { id: "owner-1" };

const baseDraft: TenderDraft = {
  id: "tender-1",
  ownerId: actor.id,
  status: "DRAFT",
  specialty: "CONSTRUCTION_REPAIR",
  serviceCode: "GENERAL_CONSTRUCTION",
  title: "Repaint two rooms",
  shortDescription: null,
  fullDescription: null,
  scopeOfWork: null,
  budgetMinorUnits: null,
  currency: null,
  desiredStartDate: null,
  deadline: null,
  workerNotes: null,
  equipmentNotes: null,
  materialNotes: null,
  location: null,
  conditions: null,
  publishedAt: null,
  cancelledAt: null,
  cancelReason: null,
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
};

// Captures whatever `TenderLocation` the command hands to the repository, so
// the test can assert on the command's own branch logic rather than on
// anything a real database round-trip would echo back.
class CapturingRepository implements SyncTenderLocationRepository {
  capturedLocation: TenderLocation | null = null;

  async updateLocation(_id: string, location: TenderLocation) {
    this.capturedLocation = location;
    return { ok: true as const, value: { ...baseDraft, location } };
  }
}

// Deliberately returns coordinates that differ from whatever was passed in,
// unlike `GazetteerGeocoder.reverseGeocode`, which echoes its input back. A
// real geocoding vendor would snap/canonicalize coordinates this way, so this
// is what makes the PIN-mode ternary's two branches distinguishable: if the
// command ever used the geocoder's resolved value for PIN mode instead of the
// submitted pin, this stub would expose it.
const stubGeocoder: Geocoder = {
  geocode: async () => ({
    ok: true,
    value: { latitude: 0, longitude: 0, normalizedAddress: "unused" },
  }),
  reverseGeocode: async () => ({
    ok: true,
    value: {
      latitude: 12.3456,
      longitude: -65.4321,
      normalizedAddress: "Stub reverse-geocoded location",
    },
  }),
};

describe("createSyncTenderLocation", () => {
  it("preserves an entered address while adjusting its exact pin", async () => {
    const repository = new CapturingRepository();
    const sync = createSyncTenderLocation({
      repository,
      geocoder: stubGeocoder,
    });
    expect(
      (
        await sync(
          baseDraft.id,
          {
            mode: "PIN",
            city: "Tbilisi",
            addressLine: "Chavchavadze Avenue 37",
            latitude: 41.711529,
            longitude: 44.757378,
          },
          actor,
        )
      ).ok,
    ).toBe(true);
    expect(repository.capturedLocation?.addressLine).toBe(
      "Chavchavadze Avenue 37",
    );
    expect(repository.capturedLocation?.public).toEqual({
      latitude: 41.71,
      longitude: 44.76,
    });
  });
  it("persists the submitted PIN coordinates as `exact`, not the geocoder's resolved value", async () => {
    const repository = new CapturingRepository();
    const syncTenderLocation = createSyncTenderLocation({
      repository,
      geocoder: stubGeocoder,
    });

    const submittedPin = { latitude: 41.7333, longitude: 44.7912 };

    const result = await syncTenderLocation(
      baseDraft.id,
      { mode: "PIN", city: "Tbilisi", ...submittedPin },
      actor,
    );

    expect(result.ok).toBe(true);
    expect(repository.capturedLocation?.exact).toEqual(submittedPin);
    expect(repository.capturedLocation?.exact).not.toEqual({
      latitude: 12.3456,
      longitude: -65.4321,
    });
    expect(repository.capturedLocation?.public).toEqual({
      latitude: 41.73,
      longitude: 44.79,
    });
  });
});
