import type { AuthError } from "../../identity/application/require-capability";

// Typed as `Record<AuthError, number>` (not a loose string map) so that if
// `AuthError` ever gains a member, this file fails to compile until the new
// member is given a status — the same exhaustiveness guarantee
// `src/modules/identity/http/map-access-denial.ts` already relies on.
const AUTH_STATUS_BY_ERROR: Readonly<Record<AuthError, number>> = {
  UNAUTHENTICATED: 401,
  EMAIL_UNVERIFIED: 403,
  ONBOARDING_INCOMPLETE: 403,
  ACCOUNT_DISABLED: 403,
  ACCOUNT_RESTRICTED: 403,
  CAPABILITY_MISSING: 403,
};

// Tender-specific error codes (including every `PublicationBlockingReason`,
// which intentionally falls through to the `?? 400` default below).
const TENDER_STATUS_BY_ERROR: Readonly<Record<string, number>> = {
  NOT_OWNER: 403,
  TENDER_NOT_FOUND: 404,
  NOT_FOUND: 404,
  INVALID_INPUT: 400,
  NOT_DRAFT: 409,
  ALREADY_CANCELLED: 409,
  TOO_MANY_ATTACHMENTS: 409,
  UNSUPPORTED_FILE_TYPE: 422,
  FILE_TOO_LARGE: 413,
  ADDRESS_NOT_FOUND: 422,
  COORDINATES_NOT_FOUND: 422,
};

function isAuthError(error: string): error is AuthError {
  return Object.hasOwn(AUTH_STATUS_BY_ERROR, error);
}

export function mapTenderError(error: string): Response {
  const status = isAuthError(error)
    ? AUTH_STATUS_BY_ERROR[error]
    : (TENDER_STATUS_BY_ERROR[error] ?? 400);
  return Response.json(
    { code: error, messageKey: `tenders.errors.${error}` },
    { status },
  );
}
