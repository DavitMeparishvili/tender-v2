import type { AuthError } from "../../identity/application/require-capability";
import type { Result } from "../../shared";
import type { TenderActor } from "../application/create-tender-draft";
import { mapTenderError } from "./map-tender-error";

export type RequireCustomer = (
  headers: Headers,
) => Promise<Result<TenderActor, AuthError>>;

// Every handler resolves the caller through this single combinator so an
// access-denial behaviour change (e.g. a future locale-aware header) only
// has to be made once, not replicated by hand at every call site. `Result`
// requires a string error, so a denial is surfaced as the already-mapped
// `Response` itself rather than wrapped in a `Result`; callers narrow with
// `instanceof Response`.
export async function authorizeCustomer(
  requireCustomer: RequireCustomer,
  headers: Headers,
): Promise<TenderActor | Response> {
  const access = await requireCustomer(headers);
  return access.ok ? access.value : mapTenderError(access.error);
}

export type RequireProvider = (
  headers: Headers,
) => Promise<Result<TenderActor, AuthError>>;

// The PROVIDER-facing analogue of `authorizeCustomer` above: discovery
// handlers need to gate on the PROVIDER capability, but the discovery
// application functions (`searchPublishedTenders`/`getPublishedTender`) take
// no actor at all, so this combinator's only job is the capability check
// itself — it discards the resolved actor rather than threading it through.
export async function authorizeProvider(
  requireProvider: RequireProvider,
  headers: Headers,
): Promise<Response | undefined> {
  const access = await requireProvider(headers);
  return access.ok ? undefined : mapTenderError(access.error);
}
