import { describe, expect, it } from "vitest";
import { offerStatus } from "./offer-status";

describe("provider offer status", () => {
  const deadline = new Date("2026-10-01T12:00:00Z");
  it("distinguishes active participation from a result still being processed", () => {
    expect(
      offerStatus("SUBMITTED", "PUBLISHED", deadline, deadline.getTime() - 1),
    ).toBe("active");
    expect(
      offerStatus("SUBMITTED", "PUBLISHED", deadline, deadline.getTime()),
    ).toBe("pending");
  });
  it.each([
    ["WITHDRAWN", "PUBLISHED", "withdrawn"],
    ["WITHDRAWN", "CLOSED", "withdrawn"],
    ["WINNER", "CLOSED", "won"],
    ["LOST", "CLOSED", "lost"],
    ["SUBMITTED", "CANCELLED", "cancelled"],
    ["SUBMITTED", "EXPIRED", "ended"],
  ])("keeps %s / %s terminal", (bid, tender, expected) => {
    expect(offerStatus(bid, tender, deadline, 0)).toBe(expected);
  });
  it("reports a standing offer as under review while the client chooses", () => {
    expect(offerStatus("SUBMITTED", "AWAITING_SELECTION", deadline, 0)).toBe(
      "pending",
    );
  });
  it("reports a standing offer as on hold once another offer was chosen", () => {
    expect(offerStatus("SUBMITTED", "CLOSED", deadline, 0)).toBe("standby");
  });
});
