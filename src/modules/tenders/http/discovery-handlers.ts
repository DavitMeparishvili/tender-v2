import type { Result } from "../../shared";
import type {
  PublicTenderDetail,
  PublicTenderSummary,
} from "../domain/masking";
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
      const denied = await authorizeProvider(requireProvider, request.headers);
      if (denied) return denied;
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
  getDetail: (
    id: string,
  ) => Promise<Result<PublicTenderDetail, "TENDER_NOT_FOUND">>;
}>;

export function createDiscoveredTenderHandlers({
  requireProvider,
  getDetail,
}: DiscoveredTenderHandlersDependencies) {
  return {
    GET: async (request: Request, context: RouteContext): Promise<Response> => {
      const denied = await authorizeProvider(requireProvider, request.headers);
      if (denied) return denied;
      const { id } = await context.params;
      const result = await getDetail(id);
      return result.ok
        ? Response.json({ tender: result.value })
        : mapTenderError(result.error);
    },
  };
}
