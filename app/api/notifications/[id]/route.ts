import { markInboxReadHandler } from "../../../../src/modules/notifications/http/inbox-handlers";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return markInboxReadHandler(request, (await context.params).id);
}
