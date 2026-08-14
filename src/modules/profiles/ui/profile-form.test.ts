import { describe, expect, it } from "vitest";
import { serializeProfileUpdate } from "./profile-form";

describe("profile form serialization", () => {
  it("includes only editable own-profile fields", () => {
    const form = new FormData();
    form.set("displayName", " Updated Company ");
    form.set("phoneE164", "+995 (555) 12-34-56");
    form.set("city", " Batumi ");
    form.set("activityDescription", " Updated activity ");
    form.set("preferredLocale", "en");
    form.set("preferredCurrency", "USD");
    form.set("removePhoto", "on");
    form.set("userId", "forged-user");
    form.set("capabilities", "ADMIN");
    form.set("disabledAt", "2099-01-01");
    form.set("restrictedUntil", "2099-01-01");

    expect(serializeProfileUpdate(form, "existing/photo.webp")).toEqual({
      displayName: "Updated Company",
      phoneE164: "+995555123456",
      city: "Batumi",
      activityDescription: "Updated activity",
      preferredLocale: "en",
      preferredCurrency: "USD",
      profilePhotoObjectKey: null,
    });
  });
});
