import { reviewHandlers } from "../../../../../src/modules/reviews/http/review-handlers";

export async function GET(
  _request: Request,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  return reviewHandlers.listForProfile((await context.params).id);
}
