import { expect, it, vi } from "vitest";
import type { CurrentUser } from "../../../../src/modules/identity/application/current-user";
import { createOnboardingHandler } from "../../../../src/modules/profiles/http/onboarding-handler";

const currentUser: CurrentUser = {
  id: "route-user",
  email: "route@example.test",
  emailVerified: true,
  displayName: "Route User",
  capabilities: [],
  providerSpecialties: [],
  preferredLocale: "ka",
  preferredCurrency: "GEL",
  onboardingComplete: false,
  disabledAt: null,
  restrictedUntil: null,
};

it("rejects forged identity and capability fields before the use case", async () => {
  const complete = vi.fn();
  const POST = createOnboardingHandler({
    getCurrentUser: async () => currentUser,
    complete,
  });
  const response = await POST(
    new Request("http://localhost/api/onboarding/complete", {
      method: "POST",
      body: JSON.stringify({
        intent: "CLIENT",
        accountKind: "PERSON",
        displayName: "Route User",
        phoneE164: "+995555000030",
        countryCode: "GE",
        city: "Tbilisi",
        activityDescription: "Route contract",
        preferredLocale: "ka",
        preferredCurrency: "GEL",
        userId: "victim",
        capabilities: ["ADMIN"],
      }),
    }),
  );

  expect(response.status).toBe(400);
  expect(complete).not.toHaveBeenCalled();
});

it("returns 401 before parsing a command when no session exists", async () => {
  const POST = createOnboardingHandler({
    getCurrentUser: async () => null,
    complete: vi.fn(),
  });

  const response = await POST(
    new Request("http://localhost/api/onboarding/complete", {
      method: "POST",
      body: "{}",
    }),
  );

  expect(response.status).toBe(401);
});
