import type { AuthError } from "../../identity/application/require-capability";
import type { Result } from "../../shared";
import type { ClientBidView } from "../application/list-tender-bids";
import type { ReviseBidError } from "../application/revise-bid";
import type { BidActor, SubmitBidError } from "../application/submit-bid";
import type { WithdrawBidError } from "../application/withdraw-bid";
import type { Bid } from "../domain/bid";
import type { BidSummary } from "../domain/bid-summary";
import { mapBiddingError } from "./map-bidding-error";

export type RequireActor = (
  headers: Headers,
) => Promise<Result<BidActor, AuthError>>;

type RouteContext = Readonly<{ params: Promise<Readonly<{ id: string }>> }>;

async function authorize(
  require: RequireActor,
  headers: Headers,
): Promise<BidActor | Response> {
  const access = await require(headers);
  return access.ok ? access.value : mapBiddingError(access.error);
}

export function createBidHandlers({
  requireProvider,
  requireCustomer,
  submit,
  list,
}: Readonly<{
  requireProvider: RequireActor;
  requireCustomer: RequireActor;
  submit: (
    tenderId: string,
    input: unknown,
    actor: BidActor,
  ) => Promise<Result<Bid, SubmitBidError>>;
  list: (
    tenderId: string,
    actor: BidActor,
  ) => Promise<
    Result<readonly ClientBidView[], "TENDER_NOT_FOUND" | "NOT_OWNER">
  >;
}>) {
  return {
    POST: async (
      request: Request,
      context: RouteContext,
    ): Promise<Response> => {
      const actor = await authorize(requireProvider, request.headers);
      if (actor instanceof Response) return actor;
      const { id } = await context.params;
      const body = await request.json().catch(() => null);
      const result = await submit(id, body, actor);
      return result.ok
        ? Response.json({ bid: result.value })
        : mapBiddingError(result.error);
    },
    // The comparison read requires CUSTOMER: it is the tender owner's view,
    // and ownership is re-checked in the use case rather than inferred from
    // the capability alone.
    GET: async (request: Request, context: RouteContext): Promise<Response> => {
      const actor = await authorize(requireCustomer, request.headers);
      if (actor instanceof Response) return actor;
      const { id } = await context.params;
      const result = await list(id, actor);
      return result.ok
        ? Response.json({ bids: result.value })
        : mapBiddingError(result.error);
    },
  };
}

export function createOwnBidHandlers({
  requireProvider,
  revise,
  withdraw,
}: Readonly<{
  requireProvider: RequireActor;
  revise: (
    tenderId: string,
    input: unknown,
    actor: BidActor,
  ) => Promise<Result<Bid, ReviseBidError>>;
  withdraw: (
    tenderId: string,
    actor: BidActor,
  ) => Promise<Result<Bid, WithdrawBidError>>;
}>) {
  return {
    PATCH: async (
      request: Request,
      context: RouteContext,
    ): Promise<Response> => {
      const actor = await authorize(requireProvider, request.headers);
      if (actor instanceof Response) return actor;
      const { id } = await context.params;
      const body = await request.json().catch(() => null);
      const result = await revise(id, body, actor);
      return result.ok
        ? Response.json({ bid: result.value })
        : mapBiddingError(result.error);
    },
    DELETE: async (
      request: Request,
      context: RouteContext,
    ): Promise<Response> => {
      const actor = await authorize(requireProvider, request.headers);
      if (actor instanceof Response) return actor;
      const { id } = await context.params;
      const result = await withdraw(id, actor);
      return result.ok
        ? Response.json({ bid: result.value })
        : mapBiddingError(result.error);
    },
  };
}

export function createBidSummaryHandlers({
  requireProvider,
  summarize,
}: Readonly<{
  requireProvider: RequireActor;
  summarize: (
    tenderId: string,
  ) => Promise<Result<BidSummary, "TENDER_NOT_FOUND">>;
}>) {
  return {
    GET: async (request: Request, context: RouteContext): Promise<Response> => {
      const actor = await authorize(requireProvider, request.headers);
      if (actor instanceof Response) return actor;
      const { id } = await context.params;
      const result = await summarize(id);
      return result.ok
        ? Response.json({ summary: result.value })
        : mapBiddingError(result.error);
    },
  };
}
