import { getProfileReviews } from "../application/get-profile-reviews";
import {
  publishReview,
  type PublishReviewError,
} from "../application/publish-review";
import { reviewErrorStatus } from "./map-review-error";

type Actor = Readonly<{ id: string }>;
type Require = (
  headers: Headers,
) => Promise<
  Readonly<{ ok: true; value: Actor }> | Readonly<{ ok: false; error: string }>
>;

export function createReviewHandlers(
  dependencies: Readonly<{
    require: Require;
    publish: (
      agreementId: string,
      input: unknown,
      actor: Actor,
    ) => Promise<
      | Readonly<{ ok: true; value: unknown }>
      | Readonly<{ ok: false; error: PublishReviewError }>
    >;
    getForProfile: (userId: string) => Promise<unknown>;
  }>,
) {
  return {
    async publish(request: Request, agreementId: string): Promise<Response> {
      const actor = await dependencies.require(request.headers);
      if (!actor.ok) {
        return Response.json(
          { code: actor.error },
          { status: actor.error === "UNAUTHENTICATED" ? 401 : 403 },
        );
      }
      const input = await request.json().catch(() => null);
      const result = await dependencies.publish(
        agreementId,
        input,
        actor.value,
      );
      return result.ok
        ? Response.json({ review: result.value }, { status: 201 })
        : Response.json(
            { code: result.error },
            { status: reviewErrorStatus(result.error) },
          );
    },
    async listForProfile(userId: string): Promise<Response> {
      const result = await dependencies.getForProfile(userId);
      return Response.json(result);
    },
  };
}

export const reviewHandlers = createReviewHandlers({
  require: async (headers) => {
    const { requireAnyCommercialCapability } =
      await import("../../identity/application/require-capability");
    return requireAnyCommercialCapability(headers);
  },
  publish: publishReview,
  getForProfile: getProfileReviews,
});
