import { describe, expect, it } from "vitest";
import {
  AGREEMENT_CONFIRMATION_WINDOW_MS,
  confirmationDeadline,
} from "./agreement";

describe("confirmationDeadline", () => {
  it("gives both parties exactly 48 hours to confirm", () => {
    expect(AGREEMENT_CONFIRMATION_WINDOW_MS).toBe(48 * 60 * 60 * 1000);
    expect(confirmationDeadline(new Date("2026-07-01T09:00:00.000Z"))).toEqual(
      new Date("2026-07-03T09:00:00.000Z"),
    );
  });

  it("does not mutate the instant it is given", () => {
    const now = new Date("2026-07-01T09:00:00.000Z");
    confirmationDeadline(now);
    expect(now.toISOString()).toBe("2026-07-01T09:00:00.000Z");
  });
});
