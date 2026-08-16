import { describe, expect, it } from "vitest";
import { FakeClock } from "../../shared";
import { createGetTenderForProvider } from "./get-tender-for-provider";
import type { TenderRecord } from "../domain/tender";

const record = {
  id: "tender-1",
  ownerId: "client-1",
  status: "PUBLISHED",
  specialty: "CONSTRUCTION_REPAIR",
  serviceCode: "GENERAL_CONSTRUCTION",
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
  conditions: "Weekdays only.",
  publishedAt: new Date("2026-06-01T09:00:00.000Z"),
  cancelledAt: null,
  cancelReason: null,
  createdAt: new Date("2026-06-01T08:00:00.000Z"),
  updatedAt: new Date("2026-06-01T09:00:00.000Z"),
} satisfies TenderRecord;

const repository = {
  getSettleable: async (id: string) =>
    id === "tender-1"
      ? ({ ok: true, value: record } as const)
      : ({ ok: false, error: "TENDER_NOT_FOUND" } as const),
};
const clock = new FakeClock(new Date("2026-06-10T00:00:00.000Z"));

describe("getTenderForProvider", () => {
  it("returns the masked projection when the provider is not entitled", async () => {
    const view = await createGetTenderForProvider({
      repository,
      clock,
      isEntitled: async () => false,
    })("tender-1", { id: "provider-1" });

    expect(view).toMatchObject({ ok: true, value: { disclosure: "MASKED" } });
    if (!view.ok) throw new Error("expected a view");
    expect(JSON.stringify(view.value.tender)).not.toContain(
      "1 Chavchavadze Ave",
    );
  });

  it("returns the full projection when the provider is entitled", async () => {
    const view = await createGetTenderForProvider({
      repository,
      clock,
      isEntitled: async () => true,
    })("tender-1", { id: "provider-1" });

    expect(view).toMatchObject({
      ok: true,
      value: {
        disclosure: "FULL",
        tender: { addressLine: "1 Chavchavadze Ave" },
      },
    });
  });

  it("asks the entitlement port about the requesting provider and tender", async () => {
    const seen: Array<readonly [string, string]> = [];
    await createGetTenderForProvider({
      repository,
      clock,
      isEntitled: async (providerId, tenderId) => {
        seen.push([providerId, tenderId]);
        return false;
      },
    })("tender-1", { id: "provider-7" });

    expect(seen).toEqual([["provider-7", "tender-1"]]);
  });

  it("reports a missing tender rather than an empty masked view", async () => {
    const view = await createGetTenderForProvider({
      repository,
      clock,
      isEntitled: async () => true,
    })("tender-missing", { id: "provider-1" });

    expect(view).toEqual({ ok: false, error: "TENDER_NOT_FOUND" });
  });
});
