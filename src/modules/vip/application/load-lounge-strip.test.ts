import { describe, expect, it, vi } from "vitest";
import type { VipPartner } from "../domain/partner";
import { createLoadLoungeStrip } from "./load-lounge-strip";

const query = { locale: "en" as const, now: new Date("2026-10-22T10:00:00Z") };

function partners(count: number): VipPartner[] {
  return Array.from({ length: count }, (_, index) => ({
    userId: `partner-${index}`,
    name: `Partner ${index}`,
    city: "Tbilisi",
    specialty: null,
    serviceLabel: "General contractor",
    description: null,
    logoPath: null,
    verified: true,
    rating: null,
    completed: 0,
  }));
}

describe("createLoadLoungeStrip", () => {
  it("applies the strip rules to the loaded partners", async () => {
    const log = vi.fn();
    const load = createLoadLoungeStrip({
      listPartners: async () => partners(6),
      log,
    });

    const strip = await load(query);

    expect(strip.visible).toBe(true);
    expect(strip.showArrows).toBe(true);
    expect(strip.partners).toHaveLength(6);
    expect(log).not.toHaveBeenCalled();
  });

  it("hides the strip and logs when the partner read fails", async () => {
    const failure = new Error("database unavailable");
    const log = vi.fn();
    const load = createLoadLoungeStrip({
      listPartners: async () => {
        throw failure;
      },
      log,
    });

    const strip = await load(query);

    expect(strip).toEqual({ visible: false, showArrows: false, partners: [] });
    expect(log).toHaveBeenCalledWith(
      "VIP Lounge partners could not be loaded.",
      failure,
    );
  });
});
