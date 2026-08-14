import { describe, expect, it } from "vitest";
import { serializeOnboarding } from "./onboarding-form";

describe("onboarding form serialization", () => {
  it("normalizes the public command and excludes authority fields", () => {
    const form = new FormData();
    form.set("accountKind", "COMPANY");
    form.set("displayName", "  Build Georgia  ");
    form.set("phoneE164", "+995 (555) 12-34-56");
    form.set("city", "  Tbilisi ");
    form.set("activityDescription", " Construction and repair contractor ");
    form.set("preferredCurrency", "GEL");
    form.set("userId", "forged-user");
    form.set("capabilities", "ADMIN");
    form.set("restrictedUntil", "2099-01-01");

    expect(serializeOnboarding(form, "CONSTRUCTION_PROVIDER", "ka")).toEqual({
      intent: "CONSTRUCTION_PROVIDER",
      accountKind: "COMPANY",
      displayName: "Build Georgia",
      phoneE164: "+995555123456",
      countryCode: "GE",
      city: "Tbilisi",
      activityDescription: "Construction and repair contractor",
      preferredLocale: "ka",
      preferredCurrency: "GEL",
    });
  });
});
