import { describe, expect, it } from "vitest";
import { toPublicDetail, toPublicSummary } from "./masking";
import type { TenderRecord } from "./tender";

const published: TenderRecord = {
  id: "tender-1",
  ownerId: "owner-1",
  status: "PUBLISHED",
  specialty: "CONSTRUCTION_REPAIR",
  title: "Renovate a two-bedroom apartment",
  shortDescription: "Full interior renovation",
  fullDescription: "Strip and rebuild kitchen and bathroom finishes.",
  scopeOfWork: "Demolition, plumbing, tiling, painting",
  budgetMinorUnits: 500_000,
  currency: "GEL",
  desiredStartDate: null,
  deadline: new Date("2026-09-01T00:00:00.000Z"),
  workerNotes: "Need two tilers",
  equipmentNotes: null,
  materialNotes: null,
  location: {
    countryCode: "GE",
    city: "Tbilisi",
    district: "Vake",
    addressLine: "1 Chavchavadze Ave",
    exact: { latitude: 41.7151, longitude: 44.8271 },
    public: { latitude: 41.72, longitude: 44.83 },
  },
  conditions: "Client supplies parking access",
  publishedAt: new Date("2026-08-15T00:00:00.000Z"),
  cancelledAt: null,
  cancelReason: null,
  createdAt: new Date("2026-08-15T00:00:00.000Z"),
  updatedAt: new Date("2026-08-15T00:00:00.000Z"),
};

describe("toPublicSummary / toPublicDetail", () => {
  it("never exposes exact coordinates, address line, owner id, or conditions", () => {
    const summary = toPublicSummary(published);
    const detail = toPublicDetail(published);
    const serialized = JSON.stringify({ summary, detail });

    expect(serialized).not.toContain("41.7151");
    expect(serialized).not.toContain("44.8271");
    expect(serialized).not.toContain("Chavchavadze");
    expect(serialized).not.toContain("owner-1");
    expect(serialized).not.toContain("parking access");
    expect((summary as Record<string, unknown>).attachments).toBeUndefined();
  });

  it("exposes only the coarsened public coordinates", () => {
    expect(toPublicSummary(published)).toMatchObject({
      city: "Tbilisi",
      district: "Vake",
      publicLatitude: 41.72,
      publicLongitude: 44.83,
    });
  });
});
