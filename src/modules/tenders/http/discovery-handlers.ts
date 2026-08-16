import type { Result } from "../../shared";
import type { ProviderTenderView } from "../application/get-tender-for-provider";
import type { AttachmentRecord } from "../application/upload-tender-attachment";
import type { PublicTenderSummary } from "../domain/masking";
import { authorizeProvider, type RequireProvider } from "./authorize";
import { mapTenderError } from "./map-tender-error";

export type { RequireProvider };

type RouteContext = Readonly<{ params: Promise<Readonly<{ id: string }>> }>;

type DiscoveryHandlersDependencies = Readonly<{
  requireProvider: RequireProvider;
  search: (
    input: unknown,
  ) => Promise<Result<readonly PublicTenderSummary[], "INVALID_INPUT">>;
}>;

export function createDiscoveryHandlers({
  requireProvider,
  search,
}: DiscoveryHandlersDependencies) {
  return {
    GET: async (request: Request): Promise<Response> => {
      const actor = await authorizeProvider(requireProvider, request.headers);
      if (actor instanceof Response) return actor;
      const query = Object.fromEntries(new URL(request.url).searchParams);
      const result = await search(query);
      return result.ok
        ? Response.json({ tenders: result.value })
        : mapTenderError(result.error);
    },
  };
}

type DiscoveredTenderHandlersDependencies = Readonly<{
  requireProvider: RequireProvider;
  getForProvider: (
    id: string,
    actor: Readonly<{ id: string }>,
  ) => Promise<Result<ProviderTenderView, "TENDER_NOT_FOUND">>;
}>;

export function createDiscoveredTenderHandlers({
  requireProvider,
  getForProvider,
}: DiscoveredTenderHandlersDependencies) {
  return {
    GET: async (request: Request, context: RouteContext): Promise<Response> => {
      const actor = await authorizeProvider(requireProvider, request.headers);
      if (actor instanceof Response) return actor;
      const { id } = await context.params;
      const result = await getForProvider(id, actor);
      // `disclosure` travels with the payload so the client renders the level
      // the server actually granted rather than inferring it from which
      // fields happen to be present.
      return result.ok
        ? Response.json({
            disclosure: result.value.disclosure,
            tender: result.value.tender,
          })
        : mapTenderError(result.error);
    },
  };
}

type EntitledAttachmentHandlersDependencies = Readonly<{
  requireProvider: RequireProvider;
  list: (
    tenderId: string,
    actor: Readonly<{ id: string }>,
  ) => Promise<Result<readonly AttachmentRecord[], "NOT_ENTITLED">>;
}>;

export function createEntitledAttachmentHandlers({
  requireProvider,
  list,
}: EntitledAttachmentHandlersDependencies) {
  return {
    GET: async (request: Request, context: RouteContext): Promise<Response> => {
      const actor = await authorizeProvider(requireProvider, request.headers);
      if (actor instanceof Response) return actor;
      const { id } = await context.params;
      const result = await list(id, actor);
      // The same explicit allowlist `attachment-handlers.ts` uses:
      // `objectKey` is an internal storage address and never leaves the
      // server.
      return result.ok
        ? Response.json({
            attachments: result.value.map((record) => ({
              id: record.id,
              tenderId: record.tenderId,
              originalFileName: record.originalFileName,
              mimeType: record.mimeType,
              sizeBytes: record.sizeBytes,
              createdAt: record.createdAt,
            })),
          })
        : mapTenderError(result.error);
    },
  };
}
