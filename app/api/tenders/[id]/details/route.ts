import { requireCapability } from "@/src/modules/identity/application/require-capability";
import { editPublishedTender } from "@/src/modules/tenders/application/edit-published-tender";
import { mapTenderError } from "@/src/modules/tenders/http/map-tender-error";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireCapability(request.headers, "CUSTOMER");
  if (!access.ok) return mapTenderError(access.error);
  const { id } = await context.params;
  const result = await editPublishedTender(
    id,
    await request.json().catch(() => null),
    access.value,
  );
  if (!result.ok)
    return result.error === "EDIT_NOT_ALLOWED"
      ? Response.json({ error: result.error }, { status: 409 })
      : mapTenderError(result.error);
  return Response.json({ ok: true });
}
