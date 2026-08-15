// Every `AuthError` value from `require-capability` is listed so an access
// denial can never fall through to the 400 default, matching the statuses
// `src/modules/identity/http/map-access-denial.ts` already assigns.
const STATUS_BY_ERROR: Readonly<Record<string, number>> = {
  UNAUTHENTICATED: 401,
  EMAIL_UNVERIFIED: 403,
  ONBOARDING_INCOMPLETE: 403,
  ACCOUNT_DISABLED: 403,
  ACCOUNT_RESTRICTED: 403,
  CAPABILITY_MISSING: 403,
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

export function mapTenderError(error: string): Response {
  const status = STATUS_BY_ERROR[error] ?? 400;
  return Response.json(
    { code: error, messageKey: `tenders.errors.${error}` },
    { status },
  );
}
