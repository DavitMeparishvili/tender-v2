import type { CurrentUser } from "../../identity/application/current-user";
import {
  updateOwnProfileCommandSchema,
  type ProfileActor,
  type ProfileUpdateError,
} from "../application/update-own-profile";
import type { SafeProfileView } from "../application/complete-onboarding";
import type { Result } from "../../shared";

type CurrentUserResolver = (headers: Headers) => Promise<CurrentUser | null>;
type GetOwn = (
  actor: ProfileActor,
) => Promise<Result<SafeProfileView, "PROFILE_NOT_FOUND">>;
type UpdateOwn = (
  input: unknown,
  actor: ProfileActor,
) => Promise<Result<SafeProfileView, ProfileUpdateError>>;

type Dependencies = Readonly<{
  getCurrentUser: CurrentUserResolver;
  getOwn: GetOwn;
  updateOwn: UpdateOwn;
}>;

function unauthenticated(): Response {
  return Response.json(
    { code: "UNAUTHENTICATED", messageKey: "access.unauthenticated" },
    { status: 401 },
  );
}

function profileError(error: ProfileUpdateError): Response {
  const status =
    error === "INVALID_INPUT" ? 400 : error === "PHONE_CONFLICT" ? 409 : 404;
  return Response.json(
    { code: error, messageKey: `errors.${error}` },
    { status },
  );
}

export function createProfileHandlers({
  getCurrentUser,
  getOwn,
  updateOwn,
}: Dependencies) {
  return {
    GET: async (request: Request): Promise<Response> => {
      const user = await getCurrentUser(request.headers);
      if (user === null) return unauthenticated();
      const result = await getOwn({ id: user.id });
      return result.ok
        ? Response.json({ profile: result.value })
        : profileError(result.error);
    },
    PATCH: async (request: Request): Promise<Response> => {
      const user = await getCurrentUser(request.headers);
      if (user === null) return unauthenticated();
      const body = await request.json().catch(() => null);
      const parsed = updateOwnProfileCommandSchema.safeParse(body);
      if (!parsed.success) return profileError("INVALID_INPUT");
      const result = await updateOwn(parsed.data, { id: user.id });
      return result.ok
        ? Response.json({ profile: result.value })
        : profileError(result.error);
    },
  };
}
