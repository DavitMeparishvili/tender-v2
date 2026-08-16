import { reviewHandlers } from "../../../../../src/modules/reviews/http/review-handlers";

export async function PATCH(
  request: Request,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  return reviewHandlers.redact(request, (await context.params).id);
}
