import type { AuthError } from "../../identity/application/require-capability";
import type { Result } from "../../shared";
import type { ConfirmCheckoutError } from "../application/confirm-access-checkout";
import type {
  AccessActor,
  CheckoutView,
  StartCheckoutError,
} from "../application/start-access-checkout";
import type { Entitlement } from "../domain/entitlement";
import { mapAccessError } from "./map-access-error";

export type RequireProvider = (
  headers: Headers,
) => Promise<Result<AccessActor, AuthError>>;

type ConfirmRouteContext = Readonly<{
  params: Promise<Readonly<{ checkoutId: string }>>;
}>;

// One combinator, exactly like `authorizeCustomer`/`authorizeProvider` in the
// tenders module: a denial is already a mapped `Response`, so callers narrow
// with `instanceof Response`.
async function authorizeProvider(
  requireProvider: RequireProvider,
  headers: Headers,
): Promise<AccessActor | Response> {
  const access = await requireProvider(headers);
  return access.ok ? access.value : mapAccessError(access.error);
}

export function createCheckoutHandlers({
  requireProvider,
  start,
}: Readonly<{
  requireProvider: RequireProvider;
  start: (
    input: unknown,
    actor: AccessActor,
  ) => Promise<Result<CheckoutView, StartCheckoutError>>;
}>) {
  return {
    POST: async (request: Request): Promise<Response> => {
      const actor = await authorizeProvider(requireProvider, request.headers);
      if (actor instanceof Response) return actor;
      const body = await request.json().catch(() => null);
      const result = await start(body, actor);
      return result.ok
        ? Response.json({ checkout: result.value })
        : mapAccessError(result.error);
    },
  };
}

export function createCheckoutConfirmHandlers({
  requireProvider,
  confirm,
}: Readonly<{
  requireProvider: RequireProvider;
  confirm: (
    checkoutId: string,
    actor: AccessActor,
  ) => Promise<Result<Entitlement, ConfirmCheckoutError>>;
}>) {
  return {
    POST: async (
      request: Request,
      context: ConfirmRouteContext,
    ): Promise<Response> => {
      const actor = await authorizeProvider(requireProvider, request.headers);
      if (actor instanceof Response) return actor;
      const { checkoutId } = await context.params;
      const result = await confirm(checkoutId, actor);
      return result.ok
        ? Response.json({ entitlement: result.value })
        : mapAccessError(result.error);
    },
  };
}

export function createEntitlementHandlers({
  requireProvider,
  list,
}: Readonly<{
  requireProvider: RequireProvider;
  list: (actor: AccessActor) => Promise<readonly Entitlement[]>;
}>) {
  return {
    GET: async (request: Request): Promise<Response> => {
      const actor = await authorizeProvider(requireProvider, request.headers);
      if (actor instanceof Response) return actor;
      return Response.json({ entitlements: await list(actor) });
    },
  };
}
