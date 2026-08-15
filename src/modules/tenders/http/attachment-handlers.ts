import type { Result } from "../../shared";
import type { ListAttachmentsError } from "../application/list-tender-attachments";
import type {
  AttachmentRecord,
  UploadAttachmentError,
} from "../application/upload-tender-attachment";
import type { TenderActor } from "../application/create-tender-draft";
import { authorizeCustomer, type RequireCustomer } from "./authorize";
import { mapTenderError } from "./map-tender-error";

type RouteContext = Readonly<{ params: Promise<Readonly<{ id: string }>> }>;
type DownloadRouteContext = Readonly<{
  params: Promise<Readonly<{ id: string; attachmentId: string }>>;
}>;

// `objectKey` is an internal storage address and must never reach a
// client-facing response, so the view is built as an explicit allowlist
// rather than by omitting fields from the record.
function toAttachmentView(
  record: AttachmentRecord,
): Omit<AttachmentRecord, "objectKey"> {
  return {
    id: record.id,
    tenderId: record.tenderId,
    originalFileName: record.originalFileName,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    createdAt: record.createdAt,
  };
}

type AttachmentHandlersDependencies = Readonly<{
  requireCustomer: RequireCustomer;
  upload: (
    tenderId: string,
    upload: Readonly<{ originalFileName: string; body: Uint8Array }>,
    actor: TenderActor,
  ) => Promise<Result<AttachmentRecord, UploadAttachmentError>>;
  list: (
    tenderId: string,
    actor: TenderActor,
  ) => Promise<Result<readonly AttachmentRecord[], ListAttachmentsError>>;
}>;

export function createAttachmentHandlers({
  requireCustomer,
  upload,
  list,
}: AttachmentHandlersDependencies) {
  return {
    POST: async (
      request: Request,
      context: RouteContext,
    ): Promise<Response> => {
      const access = await authorizeCustomer(requireCustomer, request.headers);
      if (access instanceof Response) return access;
      const { id } = await context.params;
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) return mapTenderError("INVALID_INPUT");
      const body = new Uint8Array(await file.arrayBuffer());
      const result = await upload(
        id,
        { originalFileName: file.name, body },
        access,
      );
      return result.ok
        ? Response.json({ attachment: toAttachmentView(result.value) })
        : mapTenderError(result.error);
    },
    GET: async (request: Request, context: RouteContext): Promise<Response> => {
      const access = await authorizeCustomer(requireCustomer, request.headers);
      if (access instanceof Response) return access;
      const { id } = await context.params;
      const result = await list(id, access);
      return result.ok
        ? Response.json({
            attachments: result.value.map(toAttachmentView),
          })
        : mapTenderError(result.error);
    },
  };
}

type AttachmentDownloadHandlerDependencies = Readonly<{
  requireCustomer: RequireCustomer;
  getDownload: (
    tenderId: string,
    attachmentId: string,
    actor: TenderActor,
  ) => Promise<Result<string, "NOT_FOUND" | "NOT_OWNER">>;
}>;

export function createAttachmentDownloadHandler({
  requireCustomer,
  getDownload,
}: AttachmentDownloadHandlerDependencies) {
  return {
    GET: async (
      request: Request,
      context: DownloadRouteContext,
    ): Promise<Response> => {
      const access = await authorizeCustomer(requireCustomer, request.headers);
      if (access instanceof Response) return access;
      const { id, attachmentId } = await context.params;
      const result = await getDownload(id, attachmentId, access);
      return result.ok
        ? Response.json({ url: result.value })
        : mapTenderError(result.error);
    },
  };
}
