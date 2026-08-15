import type { Result } from "../../shared";
import type { TenderActor } from "../application/create-tender-draft";
import type { CancelError } from "../application/cancel-tender";
import type { PublishError } from "../application/publish-tender";
import type { SyncLocationError } from "../application/sync-tender-location";
import type { TenderMutationError } from "../application/update-tender-draft";
import type { TenderDraft, TenderRecord } from "../domain/tender";
import { authorizeCustomer, type RequireCustomer } from "./authorize";
import { mapTenderError } from "./map-tender-error";

export type { RequireCustomer };

type RouteContext = Readonly<{ params: Promise<Readonly<{ id: string }>> }>;

type TenderHandlersDependencies = Readonly<{
  requireCustomer: RequireCustomer;
  createDraft: (
    input: unknown,
    actor: TenderActor,
  ) => Promise<Result<TenderDraft, "INVALID_INPUT">>;
  listOwned: (actor: TenderActor) => Promise<readonly TenderDraft[]>;
}>;

export function createTenderHandlers({
  requireCustomer,
  createDraft,
  listOwned,
}: TenderHandlersDependencies) {
  return {
    POST: async (request: Request): Promise<Response> => {
      const access = await authorizeCustomer(requireCustomer, request.headers);
      if (access instanceof Response) return access;
      const body = await request.json().catch(() => null);
      const result = await createDraft(body, access);
      return result.ok
        ? Response.json({ tender: result.value })
        : mapTenderError(result.error);
    },
    GET: async (request: Request): Promise<Response> => {
      const access = await authorizeCustomer(requireCustomer, request.headers);
      if (access instanceof Response) return access;
      const tenders = await listOwned(access);
      return Response.json({ tenders });
    },
  };
}

type OwnedTenderHandlersDependencies = Readonly<{
  requireCustomer: RequireCustomer;
  getOwned: (
    id: string,
    actor: TenderActor,
  ) => Promise<Result<TenderDraft, "TENDER_NOT_FOUND" | "NOT_OWNER">>;
  updateDraft: (
    id: string,
    input: unknown,
    actor: TenderActor,
  ) => Promise<Result<TenderDraft, TenderMutationError | "INVALID_INPUT">>;
}>;

export function createOwnedTenderHandlers({
  requireCustomer,
  getOwned,
  updateDraft,
}: OwnedTenderHandlersDependencies) {
  return {
    GET: async (request: Request, context: RouteContext): Promise<Response> => {
      const access = await authorizeCustomer(requireCustomer, request.headers);
      if (access instanceof Response) return access;
      const { id } = await context.params;
      const result = await getOwned(id, access);
      return result.ok
        ? Response.json({ tender: result.value })
        : mapTenderError(result.error);
    },
    PATCH: async (
      request: Request,
      context: RouteContext,
    ): Promise<Response> => {
      const access = await authorizeCustomer(requireCustomer, request.headers);
      if (access instanceof Response) return access;
      const { id } = await context.params;
      const body = await request.json().catch(() => null);
      const result = await updateDraft(id, body, access);
      return result.ok
        ? Response.json({ tender: result.value })
        : mapTenderError(result.error);
    },
  };
}

type LocationHandlerDependencies = Readonly<{
  requireCustomer: RequireCustomer;
  syncLocation: (
    id: string,
    input: unknown,
    actor: TenderActor,
  ) => Promise<Result<TenderDraft, SyncLocationError | "INVALID_INPUT">>;
}>;

export function createLocationHandlers({
  requireCustomer,
  syncLocation,
}: LocationHandlerDependencies) {
  return {
    PATCH: async (
      request: Request,
      context: RouteContext,
    ): Promise<Response> => {
      const access = await authorizeCustomer(requireCustomer, request.headers);
      if (access instanceof Response) return access;
      const { id } = await context.params;
      const body = await request.json().catch(() => null);
      const result = await syncLocation(id, body, access);
      return result.ok
        ? Response.json({ tender: result.value })
        : mapTenderError(result.error);
    },
  };
}

type PublishHandlerDependencies = Readonly<{
  requireCustomer: RequireCustomer;
  publish: (
    id: string,
    actor: TenderActor,
  ) => Promise<Result<TenderRecord, PublishError>>;
}>;

export function createPublishHandlers({
  requireCustomer,
  publish,
}: PublishHandlerDependencies) {
  return {
    POST: async (
      request: Request,
      context: RouteContext,
    ): Promise<Response> => {
      const access = await authorizeCustomer(requireCustomer, request.headers);
      if (access instanceof Response) return access;
      const { id } = await context.params;
      const result = await publish(id, access);
      return result.ok
        ? Response.json({ tender: result.value })
        : mapTenderError(result.error);
    },
  };
}

type CancelHandlerDependencies = Readonly<{
  requireCustomer: RequireCustomer;
  cancel: (
    id: string,
    input: unknown,
    actor: TenderActor,
  ) => Promise<Result<TenderDraft, CancelError | "INVALID_INPUT">>;
}>;

export function createCancelHandlers({
  requireCustomer,
  cancel,
}: CancelHandlerDependencies) {
  return {
    POST: async (
      request: Request,
      context: RouteContext,
    ): Promise<Response> => {
      const access = await authorizeCustomer(requireCustomer, request.headers);
      if (access instanceof Response) return access;
      const { id } = await context.params;
      const body = await request.json().catch(() => null);
      const result = await cancel(id, body, access);
      return result.ok
        ? Response.json({ tender: result.value })
        : mapTenderError(result.error);
    },
  };
}
