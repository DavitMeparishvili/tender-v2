import { reviewHandlers } from "../../../../src/modules/reviews/http/review-handlers";

export async function GET(request: Request) {
  return reviewHandlers.listForModeration(request);
}
