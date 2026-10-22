import { describe, expect, it } from "vitest";
import { LOUNGE_STRIP_RULES, selectLoungeStrip } from "./lounge-strip";

function partners(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

describe("LOUNGE_STRIP_RULES", () => {
  it("exposes the handoff limits as data", () => {
    expect(LOUNGE_STRIP_RULES).toEqual({
      maxPartners: 12,
      minPartnersToShow: 4,
      minPartnersForArrows: 6,
    });
  });
});

describe("selectLoungeStrip", () => {
  it("hides the whole strip when fewer than 4 partners qualify", () => {
    for (const count of [0, 1, 2, 3]) {
      expect(selectLoungeStrip(partners(count))).toEqual({
        visible: false,
        showArrows: false,
        partners: [],
      });
    }
  });

  it("shows 4 and 5 partners without arrows", () => {
    for (const count of [4, 5]) {
      const strip = selectLoungeStrip(partners(count));
      expect(strip.visible).toBe(true);
      expect(strip.showArrows).toBe(false);
      expect(strip.partners).toHaveLength(count);
    }
  });

  it("shows arrows from 6 partners", () => {
    const strip = selectLoungeStrip(partners(6));
    expect(strip.visible).toBe(true);
    expect(strip.showArrows).toBe(true);
    expect(strip.partners).toHaveLength(6);
  });

  it("caps the strip at 12 partners and keeps rotation order", () => {
    const strip = selectLoungeStrip(partners(15));
    expect(strip.partners).toEqual(partners(12));
    expect(strip.showArrows).toBe(true);
  });

  it("does not change the list it is given", () => {
    const input = partners(14);
    selectLoungeStrip(input);
    expect(input).toEqual(partners(14));
  });
});
