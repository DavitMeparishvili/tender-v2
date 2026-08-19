import type { DirectUploadError } from "../application/direct-upload-tender-attachment";
import type { AttachmentRecord } from "../application/upload-tender-attachment";
import type { TenderActor } from "../application/create-tender-draft";
import { authorizeCustomer, type RequireCustomer } from "./authorize";
import { toAttachmentView } from "./attachment-handlers";
import { mapTenderError } from "./map-tender-error";

type RouteContext = Readonly<{ params: Promise<Readonly<{ id: string }>> }>;

async function jsonObject(
  request: Request,
): Promise<Record<string, unknown> | null> {
  const value: unknown = await request.json().catch(() => null);
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function createPrepareDirectUploadHandler(dependencies: {
  requireCustomer: RequireCustomer;
  prepare: (
    tenderId: string,
    input: Readonly<{
      originalFileName: string;
      sizeBytes: number;
      contentType: string;
    }>,
    actor: TenderActor,
  ) => Promise<
    | {
        ok: true;
        value: { uploadId: string; uploadUrl: string; contentType: string };
      }
    | { ok: false; error: DirectUploadError }
  >;
}) {
  return async function POST(request: Request, context: RouteContext) {
    const access = await authorizeCustomer(
      dependencies.requireCustomer,
      request.headers,
    );
    if (access instanceof Response) return access;
    const body = await jsonObject(request);
    if (
      body === null ||
      typeof body.originalFileName !== "string" ||
      typeof body.sizeBytes !== "number" ||
      typeof body.contentType !== "string"
    ) {
      return mapTenderError("INVALID_INPUT");
    }
    const { id } = await context.params;
    const result = await dependencies.prepare(
      id,
      {
        originalFileName: body.originalFileName,
        sizeBytes: body.sizeBytes,
        contentType: body.contentType,
      },
      access,
    );
    return result.ok
      ? Response.json(result.value)
      : mapTenderError(result.error);
  };
}

export function createFinalizeDirectUploadHandler(dependencies: {
  requireCustomer: RequireCustomer;
  finalize: (
    tenderId: string,
    input: Readonly<{ uploadId: string; originalFileName: string }>,
    actor: TenderActor,
  ) => Promise<
    | { ok: true; value: AttachmentRecord }
    | { ok: false; error: DirectUploadError }
  >;
}) {
  return async function POST(request: Request, context: RouteContext) {
    const access = await authorizeCustomer(
      dependencies.requireCustomer,
      request.headers,
    );
    if (access instanceof Response) return access;
    const body = await jsonObject(request);
    if (
      body === null ||
      typeof body.uploadId !== "string" ||
      typeof body.originalFileName !== "string"
    ) {
      return mapTenderError("INVALID_INPUT");
    }
    const { id } = await context.params;
    const result = await dependencies.finalize(
      id,
      { uploadId: body.uploadId, originalFileName: body.originalFileName },
      access,
    );
    return result.ok
      ? Response.json({ attachment: toAttachmentView(result.value) })
      : mapTenderError(result.error);
  };
}
