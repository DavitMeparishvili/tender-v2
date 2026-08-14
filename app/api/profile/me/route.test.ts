import { expect, it, vi } from "vitest";
import type { CurrentUser } from "../../../../src/modules/identity/application/current-user";
import { createProfileHandlers } from "../../../../src/modules/profiles/http/profile-handlers";

const currentUser: CurrentUser = {
  id: "profile-route-user",
  email: "profile-route@example.test",
  emailVerified: true,
  displayName: "Profile Route",
  capabilities: ["CUSTOMER"],
  providerSpecialties: [],
  preferredLocale: "en",
  preferredCurrency: "GEL",
  onboardingComplete: true,
  disabledAt: null,
  restrictedUntil: null,
};

it("loads the profile using only the authenticated actor", async () => {
  const getOwn = vi.fn().mockResolvedValue({
    ok: false,
    error: "PROFILE_NOT_FOUND",
  });
  const { GET } = createProfileHandlers({
    getCurrentUser: async () => currentUser,
    getOwn,
    updateOwn: vi.fn(),
  });

  await GET(new Request("http://localhost/api/profile/me?userId=victim"));

  expect(getOwn).toHaveBeenCalledWith({ id: currentUser.id });
});

it("rejects forbidden profile fields before mutation", async () => {
  const updateOwn = vi.fn();
  const { PATCH } = createProfileHandlers({
    getCurrentUser: async () => currentUser,
    getOwn: vi.fn(),
    updateOwn,
  });

  const response = await PATCH(
    new Request("http://localhost/api/profile/me", {
      method: "PATCH",
      body: JSON.stringify({
        city: "Batumi",
        userId: "victim",
        capabilities: ["ADMIN"],
        restrictedUntil: "2099-01-01T00:00:00.000Z",
      }),
    }),
  );

  expect(response.status).toBe(400);
  expect(updateOwn).not.toHaveBeenCalled();
});
