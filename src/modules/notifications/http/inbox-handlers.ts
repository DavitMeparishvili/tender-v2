import { z } from "zod";
import { listInbox } from "../application/list-inbox";
import { markInboxItemRead } from "../application/mark-inbox-item-read";
import { requireAnyCommercialCapability } from "../../identity/application/require-capability";
export async function listInboxHandler(request: Request): Promise<Response> {
  const actor = await requireAnyCommercialCapability(request.headers);
  return actor.ok
    ? Response.json({ notifications: await listInbox(actor.value) })
    : Response.json(
        { code: actor.error },
        { status: actor.error === "UNAUTHENTICATED" ? 401 : 403 },
      );
}
export async function markInboxReadHandler(
  request: Request,
  id: string,
): Promise<Response> {
  const actor = await requireAnyCommercialCapability(request.headers);
  if (!actor.ok)
    return Response.json(
      { code: actor.error },
      { status: actor.error === "UNAUTHENTICATED" ? 401 : 403 },
    );
  const parsed = z
    .object({ read: z.literal(true) })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ code: "INVALID_REQUEST" }, { status: 422 });
  const result = await markInboxItemRead(id, actor.value);
  return result.ok
    ? Response.json({ notification: result.value })
    : Response.json({ code: result.error }, { status: 404 });
}
