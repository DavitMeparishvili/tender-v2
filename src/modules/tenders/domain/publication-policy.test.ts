import { describe, expect, it } from "vitest";
import { evaluateDraftForPublication } from "./publication-policy";
import type { TenderDraft } from "./tender";

const now = new Date("2026-08-15T12:00:00.000Z");
const future = new Date("2026-09-01T12:00:00.000Z");
const past = new Date("2026-08-01T12:00:00.000Z");

const complete: TenderDraft = {
  id: "tender-1",
  ownerId: "user-1",
  status: "DRAFT",
  specialty: "CONSTRUCTION_REPAIR",
  title: "Renovate a two-bedroom apartment",
  shortDescription: "Full interior renovation",
  fullDescription: "Strip and rebuild kitchen and bathroom finishes.",
  scopeOfWork: "Demolition, plumbing, tiling, painting",
  budgetMinorUnits: 500_000,
  currency: "GEL",
  desiredStartDate: null,
  deadline: future,
  workerNotes: null,
  equipmentNotes: null,
  materialNotes: null,
  location: {
    countryCode: "GE",
    city: "Tbilisi",
    district: "Vake",
    addressLine: "1 Chavchavadze Ave",
    exact: { latitude: 41.71, longitude: 44.75 },
    public: { latitude: 41.71, longitude: 44.75 },
  },
  conditions: null,
  publishedAt: null,
  cancelledAt: null,
  cancelReason: null,
  createdAt: now,
  updatedAt: now,
};

describe("evaluateDraftForPublication", () => {
  it("allows a fully populated draft with a future deadline", () => {
    expect(evaluateDraftForPublication(complete, now)).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it.each([
    [{ ...complete, shortDescription: null }, "SHORT_DESCRIPTION_REQUIRED"],
    [{ ...complete, fullDescription: null }, "FULL_DESCRIPTION_REQUIRED"],
    [{ ...complete, scopeOfWork: null }, "SCOPE_REQUIRED"],
    [{ ...complete, budgetMinorUnits: null }, "BUDGET_REQUIRED"],
    [{ ...complete, currency: null }, "BUDGET_REQUIRED"],
    [{ ...complete, location: null }, "LOCATION_REQUIRED"],
    [{ ...complete, deadline: null }, "DEADLINE_REQUIRED"],
    [{ ...complete, deadline: past }, "DEADLINE_NOT_FUTURE"],
  ] as const)("rejects an incomplete draft", (draft, reason) => {
    expect(evaluateDraftForPublication(draft, now)).toEqual({
      ok: false,
      error: reason,
    });
  });
});
