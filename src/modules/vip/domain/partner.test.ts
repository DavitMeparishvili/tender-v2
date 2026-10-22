import { describe, expect, it } from "vitest";
import { isLoungeEligible, isVipSpecialty } from "./partner";

const eligible = {
  membershipActive: true,
  isProvider: true,
  isVerified: true,
  isDisabled: false,
  hasServiceLabel: true,
};

describe("isLoungeEligible", () => {
  it("accepts a verified, enabled provider with an active membership and a label", () => {
    expect(isLoungeEligible(eligible)).toBe(true);
  });

  it.each([
    ["membership is inactive", { membershipActive: false }],
    ["account is not a provider", { isProvider: false }],
    ["profile is not verified", { isVerified: false }],
    ["account is disabled", { isDisabled: true }],
    ["there is no service label", { hasServiceLabel: false }],
  ])("rejects when %s", (_, override) => {
    expect(isLoungeEligible({ ...eligible, ...override })).toBe(false);
  });
});

describe("isVipSpecialty", () => {
  it("accepts the five provider specialties and nothing else", () => {
    expect(isVipSpecialty("TRANSPORT")).toBe(true);
    expect(isVipSpecialty("MATERIAL_SUPPLIER")).toBe(true);
    expect(isVipSpecialty("OTHER")).toBe(false);
    expect(isVipSpecialty(null)).toBe(false);
  });
});
