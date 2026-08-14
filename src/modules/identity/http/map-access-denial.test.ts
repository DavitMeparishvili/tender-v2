import { describe, expect, it } from "vitest";
import { mapAccessDenial } from "./map-access-denial";

describe("mapAccessDenial", () => {
  it.each([
    ["UNAUTHENTICATED", 401, "access.unauthenticated"],
    ["EMAIL_UNVERIFIED", 403, "access.emailUnverified"],
    ["ONBOARDING_INCOMPLETE", 403, "access.onboardingIncomplete"],
    ["ACCOUNT_DISABLED", 403, "access.accountDisabled"],
    ["ACCOUNT_RESTRICTED", 403, "access.accountRestricted"],
    ["CAPABILITY_MISSING", 403, "access.capabilityMissing"],
  ] as const)(
    "maps %s without embedding prose",
    async (code, status, messageKey) => {
      const response = mapAccessDenial(code, "en");

      expect(response.status).toBe(status);
      expect(response.headers.get("content-language")).toBe("en");
      await expect(response.json()).resolves.toEqual({ code, messageKey });
    },
  );
});
