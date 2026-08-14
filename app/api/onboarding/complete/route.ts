import { completeOnboarding } from "../../../../src/modules/profiles/application/complete-onboarding";
import { createOnboardingHandler } from "../../../../src/modules/profiles/http/onboarding-handler";

const resolveCurrentUser = async (headers: Headers) => {
  const { getCurrentUser } =
    await import("../../../../src/modules/identity/application/current-user");
  return getCurrentUser(headers);
};

export const POST = createOnboardingHandler({
  getCurrentUser: resolveCurrentUser,
  complete: completeOnboarding,
});
