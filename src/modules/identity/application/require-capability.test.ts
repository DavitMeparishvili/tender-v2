import { describe, expect, it } from "vitest";
import { FakeClock } from "../../shared";
import type { CurrentUser } from "./current-user";
import {
  createRequireCapability,
  type CommercialCapability,
} from "./require-capability";

const now = new Date("2026-08-14T12:00:00.000Z");
const activeUser: CurrentUser = {
  id: "user-1",
  email: "user@example.test",
  emailVerified: true,
  displayName: "Test User",
  capabilities: ["CUSTOMER"],
  providerSpecialties: [],
  preferredLocale: "ka",
  preferredCurrency: "GEL",
  onboardingComplete: true,
  disabledAt: null,
  restrictedUntil: null,
};

function guardFor(user: CurrentUser | null) {
  return createRequireCapability({
    getCurrentUser: async () => user,
    clock: new FakeClock(now),
  });
}

describe("requireCapability", () => {
  it("denies a missing session", async () => {
    await expect(guardFor(null)(new Headers(), "CUSTOMER")).resolves.toEqual({
      ok: false,
      error: "UNAUTHENTICATED",
    });
  });

  it.each([
    [{ ...activeUser, emailVerified: false }, "EMAIL_UNVERIFIED"],
    [{ ...activeUser, onboardingComplete: false }, "ONBOARDING_INCOMPLETE"],
    [{ ...activeUser, disabledAt: new Date("2026-08-13") }, "ACCOUNT_DISABLED"],
    [
      { ...activeUser, restrictedUntil: new Date("2026-08-15") },
      "ACCOUNT_RESTRICTED",
    ],
    [{ ...activeUser, capabilities: [] }, "CAPABILITY_MISSING"],
  ] as const)("denies unsafe account state with %s", async (user, error) => {
    await expect(guardFor(user)(new Headers(), "CUSTOMER")).resolves.toEqual({
      ok: false,
      error,
    });
  });

  it.each([
    ["CUSTOMER", { ...activeUser, capabilities: ["CUSTOMER"] }],
    [
      "PROVIDER",
      {
        ...activeUser,
        capabilities: ["PROVIDER"],
        providerSpecialties: ["CONSTRUCTION_REPAIR"],
      },
    ],
  ] as const)("allows an active %s", async (capability, user) => {
    await expect(guardFor(user)(new Headers(), capability)).resolves.toEqual({
      ok: true,
      value: user,
    });
  });

  it("allows an active ADMIN when explicitly required", async () => {
    const adminUser: CurrentUser = {
      ...activeUser,
      capabilities: ["ADMIN"],
    };
    const forgedAdmin = "ADMIN" as CommercialCapability;

    await expect(
      guardFor(adminUser)(new Headers(), forgedAdmin),
    ).resolves.toEqual({ ok: true, value: adminUser });
  });
});
