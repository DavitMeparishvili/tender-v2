import { describe, expect, it } from "vitest";
import { canUseCapability } from "./access-policy";

const now = new Date("2026-08-14T12:00:00.000Z");
const active = {
  emailVerified: true,
  onboardingComplete: true,
  disabledAt: null,
  restrictedUntil: null,
  capabilities: ["CUSTOMER"] as const,
};

describe("canUseCapability", () => {
  it("allows an active verified capability", () => {
    expect(canUseCapability(active, "CUSTOMER", now)).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it.each([
    [{ ...active, emailVerified: false }, "EMAIL_UNVERIFIED"],
    [{ ...active, onboardingComplete: false }, "ONBOARDING_INCOMPLETE"],
    [
      { ...active, disabledAt: new Date("2026-08-13T12:00:00.000Z") },
      "ACCOUNT_DISABLED",
    ],
    [
      { ...active, restrictedUntil: new Date("2026-08-14T12:00:00.001Z") },
      "ACCOUNT_RESTRICTED",
    ],
    [{ ...active, capabilities: [] }, "CAPABILITY_MISSING"],
  ] as const)("denies invalid state with %s", (state, error) => {
    expect(canUseCapability(state, "CUSTOMER", now)).toEqual({
      ok: false,
      error,
    });
  });

  it("allows an account whose restriction has ended", () => {
    expect(
      canUseCapability(
        { ...active, restrictedUntil: new Date("2026-08-14T12:00:00.000Z") },
        "CUSTOMER",
        now,
      ),
    ).toEqual({ ok: true, value: undefined });
  });
});
