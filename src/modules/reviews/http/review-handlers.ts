import { getProfileReviews } from "../application/get-profile-reviews";
import { listReviewsForModeration } from "../application/list-reviews-for-moderation";
import {
  publishReview,
  type PublishReviewError,
} from "../application/publish-review";
import { redactReview } from "../application/redact-review";
import { reviewErrorStatus } from "./map-review-error";
import { z } from "zod";

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
    requireAdmin: Require;
    listForModeration: () => Promise<unknown>;
    redact: (
      reviewId: string,
      input: Readonly<{ reason: string }>,
      admin: Actor,
    ) => Promise<
      | Readonly<{ ok: true; value: unknown }>
      | Readonly<{
          ok: false;
          error: "REVIEW_NOT_FOUND" | "INVALID_REDACTION_REASON";
        }>
    >;
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
    async listForModeration(request: Request): Promise<Response> {
      const admin = await dependencies.requireAdmin(request.headers);
      if (!admin.ok)
        return Response.json(
          { code: admin.error },
          { status: admin.error === "UNAUTHENTICATED" ? 401 : 403 },
        );
      return Response.json({ reviews: await dependencies.listForModeration() });
    },
    async redact(request: Request, reviewId: string): Promise<Response> {
      const admin = await dependencies.requireAdmin(request.headers);
      if (!admin.ok)
        return Response.json(
          { code: admin.error },
          { status: admin.error === "UNAUTHENTICATED" ? 401 : 403 },
        );
      const body = z
        .object({ action: z.literal("REDACT"), reason: z.string() })
        .strict()
        .safeParse(await request.json().catch(() => null));
      if (!body.success)
        return Response.json(
          { code: "INVALID_REDACTION_REASON" },
          { status: 422 },
        );
      const result = await dependencies.redact(
        reviewId,
        { reason: body.data.reason },
        admin.value,
      );
      return result.ok
        ? Response.json({ review: result.value })
        : Response.json(
            { code: result.error },
            { status: result.error === "REVIEW_NOT_FOUND" ? 404 : 422 },
          );
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
  requireAdmin: async (headers) => {
    const { requireCapability } =
      await import("../../identity/application/require-capability");
    return requireCapability(headers, "ADMIN");
  },
  listForModeration: listReviewsForModeration,
  redact: redactReview,
});
