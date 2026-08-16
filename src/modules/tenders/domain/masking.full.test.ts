import { describe, expect, it } from "vitest";
import { toFullDetail, toPublicDetail } from "./masking";
import type { TenderRecord } from "./tender";

const record: TenderRecord = {
  id: "tender-1",
  ownerId: "client-1",
  status: "PUBLISHED",
  specialty: "CONSTRUCTION_REPAIR",
  title: "Repaint two rooms",
  shortDescription: "Interior repaint",
  fullDescription: "Sand, prime, and repaint two bedrooms.",
  scopeOfWork: "Sanding, priming, painting",
  budgetMinorUnits: 80_000,
  currency: "GEL",
  desiredStartDate: null,
  deadline: new Date("2026-07-01T09:00:00.000Z"),
  workerNotes: null,
  equipmentNotes: null,
  materialNotes: null,
  location: {
    countryCode: "GE",
    mode: "ADDRESS",
    city: "Tbilisi",
    district: null,
    addressLine: "1 Chavchavadze Ave",
    exact: { latitude: 41.7151, longitude: 44.8271 },
    public: { latitude: 41.72, longitude: 44.83 },
  },
  conditions: "Weekdays only, 9am to 5pm.",
  publishedAt: new Date("2026-06-01T09:00:00.000Z"),
  cancelledAt: null,
  cancelReason: null,
  createdAt: new Date("2026-06-01T08:00:00.000Z"),
  updatedAt: new Date("2026-06-01T09:00:00.000Z"),
};

describe("toPublicDetail", () => {
  it("still withholds the exact address, coordinates, conditions, and owner", () => {
    const masked = JSON.stringify(toPublicDetail(record));
    expect(masked).not.toContain("1 Chavchavadze Ave");
    expect(masked).not.toContain("41.7151");
    expect(masked).not.toContain("44.8271");
    expect(masked).not.toContain("Weekdays only");
    expect(masked).not.toContain("client-1");
  });

  it("carries the settled status so a closed tender reads as closed", () => {
    expect(toPublicDetail({ ...record, status: "CLOSED" }).status).toBe(
      "CLOSED",
    );
  });
});

describe("toFullDetail", () => {
  it("adds exactly the fields entitlement unlocks and nothing more", () => {
    const full = toFullDetail(record);
    expect(full.addressLine).toBe("1 Chavchavadze Ave");
    expect(full.exactLatitude).toBe(41.7151);
    expect(full.exactLongitude).toBe(44.8271);
    expect(full.conditions).toBe("Weekdays only, 9am to 5pm.");
    // The owner's identity is not part of the tender projection even at full
    // disclosure: contact details belong to the agreement, after selection.
    expect(JSON.stringify(full)).not.toContain("client-1");
  });

  it("is a strict superset of the masked projection", () => {
    const masked = toPublicDetail(record);
    expect(toFullDetail(record)).toMatchObject(masked);
  });
});
