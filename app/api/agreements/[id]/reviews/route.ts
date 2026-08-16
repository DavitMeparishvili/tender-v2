import { reviewHandlers } from "../../../../../src/modules/reviews/http/review-handlers";

export async function POST(
  request: Request,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  return reviewHandlers.publish(request, (await context.params).id);
}
