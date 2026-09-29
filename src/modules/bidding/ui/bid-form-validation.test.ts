import { describe, expect, it } from "vitest";
import { getMessages } from "../../localization/get-messages";
import { bidAmountMinorUnits, validateBidForm } from "./bid-form-validation";

const copy = getMessages("en").bidding.validation;
function values(
  duration = "48",
  conditions = "Labour and materials included in the full offer price.",
) {
  const data = new FormData();
  data.set("durationDays", duration);
  data.set("conditions", conditions);
  return data;
}

describe("offer form validation", () => {
  it("converts money exactly without rounding extra decimals or accepting partial input", () => {
    expect(bidAmountMinorUnits("20000.50")).toBe(2_000_050);
    expect(bidAmountMinorUnits("1.01")).toBe(101);
    expect(bidAmountMinorUnits("21474836.47")).toBe(2_147_483_647);
    for (const amount of [
      "1.005",
      "21474836.48",
      "1e3",
      "20,000",
      "0",
      "-5",
      "abc",
    ]) {
      expect(bidAmountMinorUnits(amount)).toBeNull();
    }
  });

  it.each(["", "0", "-1", "1.5", "3651"])(
    "requires a valid whole-day duration (%s)",
    (duration) => {
      expect(validateBidForm(values(duration), "20000", copy)).toEqual([
        { field: "bid-duration", message: copy.duration },
      ]);
    },
  );

  it("points short trimmed terms to the conditions field, not the amount", () => {
    expect(
      validateBidForm(values("48", "  I will do it well  "), "20000", copy),
    ).toEqual([{ field: "bid-conditions", message: copy.conditions }]);
  });

  it("allows empty optional fields and duration boundaries", () => {
    expect(validateBidForm(values("1"), "0.01", copy)).toEqual([]);
    expect(validateBidForm(values("3650"), "20000.50", copy)).toEqual([]);
  });
});
