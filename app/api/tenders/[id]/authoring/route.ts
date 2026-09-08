import { requireCapability } from "@/src/modules/identity/application/require-capability";
import { saveTenderAuthoring } from "@/src/modules/tenders/application/save-tender-authoring";
import { mapTenderError } from "@/src/modules/tenders/http/map-tender-error";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireCapability(request.headers, "CUSTOMER");
  if (!access.ok) return mapTenderError(access.error);
  const { id } = await context.params;
  const result = await saveTenderAuthoring(
    id,
    await request.json().catch(() => null),
    access.value,
  );
  if (!result.ok)
    return result.error === "EDIT_NOT_ALLOWED"
      ? Response.json({ code: result.error }, { status: 409 })
      : mapTenderError(result.error);
  return Response.json({ ok: true });
}
