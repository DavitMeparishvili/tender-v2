import { describe, expect, it } from "vitest";
import { chipWidthFor } from "./vip-lounge-arrows";

// The width is chosen so that whole chips plus 40% of the next one fill the row.
function visibleCutShare(available: number, width: number): number {
  const whole = Math.floor((available + 8) / (width + 8));
  return (available - whole * 8 - whole * width) / width;
}

describe("chipWidthFor", () => {
  it("shows about 40% of the partly visible chip across tablet and desktop widths", () => {
    for (const available of [461, 512, 593, 656, 702, 731, 832]) {
      const width = chipWidthFor(available, 280);
      expect(visibleCutShare(available, width)).toBeCloseTo(0.4, 1);
    }
  });

  it("never returns a chip narrower than the minimum", () => {
    expect(chipWidthFor(120, 260)).toBeGreaterThanOrEqual(180);
  });

  it("caps chips at the given maximum width", () => {
    expect(chipWidthFor(4000, 280)).toBeLessThanOrEqual(280);
  });
});
