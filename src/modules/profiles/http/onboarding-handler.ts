import type { CurrentUser } from "../../identity/application/current-user";
import {
  completeOnboardingCommandSchema,
  type OnboardingActor,
  type OnboardingError,
  type SafeProfileView,
} from "../application/complete-onboarding";
import type { Result } from "../../shared";

type CurrentUserResolver = (headers: Headers) => Promise<CurrentUser | null>;
type CompleteOnboarding = (
  input: unknown,
  actor: OnboardingActor,
) => Promise<Result<SafeProfileView, OnboardingError>>;

type Dependencies = Readonly<{
  getCurrentUser: CurrentUserResolver;
  complete: CompleteOnboarding;
}>;

const statusByError: Readonly<Record<OnboardingError, number>> = {
  INVALID_INPUT: 400,
  USER_NOT_FOUND: 401,
  EMAIL_UNVERIFIED: 403,
  PHONE_CONFLICT: 409,
};

export function createOnboardingHandler({
  getCurrentUser,
  complete,
}: Dependencies) {
  return async function POST(request: Request): Promise<Response> {
    const user = await getCurrentUser(request.headers);
    if (user === null) {
      return Response.json(
        { code: "UNAUTHENTICATED", messageKey: "access.unauthenticated" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = completeOnboardingCommandSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { code: "INVALID_INPUT", messageKey: "errors.invalidInput" },
        { status: 400 },
      );
    }

    const result = await complete(parsed.data, {
      id: user.id,
      emailVerified: user.emailVerified,
    });
    if (!result.ok) {
      return Response.json(
        { code: result.error, messageKey: `errors.${result.error}` },
        { status: statusByError[result.error] },
      );
    }
    return Response.json({ profile: result.value }, { status: 200 });
  };
}
