import type { AuthError } from "../../identity/application/require-capability";
import type { Messages } from "../../localization/get-messages";
import type { PublicationBlockingReason } from "../domain/publication-policy";

// Every error code any tender/discovery/attachment handler can hand to
// `mapTenderError`, as one closed union. Widening it (a new application error)
// forces both records below to be extended, which is the point: an unmapped
// code cannot reach a client.
export type TenderErrorCode =
  | AuthError
  | PublicationBlockingReason
  | "TENDER_NOT_FOUND"
  | "NOT_FOUND"
  | "NOT_OWNER"
  | "NOT_DRAFT"
  | "INVALID_INPUT"
  | "ALREADY_CANCELLED"
  | "TOO_MANY_ATTACHMENTS"
  | "UNSUPPORTED_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "ADDRESS_NOT_FOUND"
  | "COORDINATES_NOT_FOUND";

// Every dotted leaf path of the message catalogs, derived from the catalog
// type itself. `MESSAGE_KEYS` below is typed against this, so a `messageKey`
// that no catalog entry can satisfy is a compile error rather than a string
// the client silently fails to resolve — `messages.test.ts` keeps ka
// key-for-key identical to en, so checking against `Messages` checks both.
type MessageKey<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${MessageKey<T[K]>}`;
}[keyof T & string];

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

// Tender-specific error codes. Every `PublicationBlockingReason` is a 400: the
// draft is simply not complete enough to publish yet.
const TENDER_STATUS_BY_ERROR: Readonly<
  Record<Exclude<TenderErrorCode, AuthError>, number>
> = {
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
  TITLE_REQUIRED: 400,
  SHORT_DESCRIPTION_REQUIRED: 400,
  FULL_DESCRIPTION_REQUIRED: 400,
  SCOPE_REQUIRED: 400,
  BUDGET_REQUIRED: 400,
  LOCATION_REQUIRED: 400,
  DEADLINE_REQUIRED: 400,
  DEADLINE_NOT_FUTURE: 400,
};

// The catalogs are camelCase and are not derived from these SCREAMING_SNAKE
// codes, so the mapping has to be written out. Interpolating the code into a
// key (`tenders.errors.${code}`) produced a key that resolved in neither
// catalog; a `Record<TenderErrorCode, MessageKey<Messages>>` makes both halves
// of that mistake — a missing code and a non-existent key — compile errors.
export const TENDER_ERROR_MESSAGE_KEYS: Readonly<
  Record<TenderErrorCode, MessageKey<Messages>>
> = {
  UNAUTHENTICATED: "access.unauthenticated",
  EMAIL_UNVERIFIED: "access.emailUnverified",
  ONBOARDING_INCOMPLETE: "access.onboardingIncomplete",
  ACCOUNT_DISABLED: "access.accountDisabled",
  ACCOUNT_RESTRICTED: "access.accountRestricted",
  CAPABILITY_MISSING: "access.capabilityMissing",
  NOT_OWNER: "tenders.errors.notOwner",
  TENDER_NOT_FOUND: "tenders.errors.notFound",
  NOT_FOUND: "tenders.errors.notFound",
  INVALID_INPUT: "tenders.errors.invalidInput",
  NOT_DRAFT: "tenders.errors.notDraft",
  ALREADY_CANCELLED: "tenders.errors.alreadyCancelled",
  TOO_MANY_ATTACHMENTS: "tenders.errors.tooManyAttachments",
  UNSUPPORTED_FILE_TYPE: "tenders.errors.unsupportedFileType",
  FILE_TOO_LARGE: "tenders.errors.fileTooLarge",
  ADDRESS_NOT_FOUND: "tenders.errors.addressNotFound",
  COORDINATES_NOT_FOUND: "tenders.errors.addressNotFound",
  // The catalogs carry no tender-specific "title is missing" copy, and the
  // wizard already renders the shared `errors.required` for this same code.
  TITLE_REQUIRED: "errors.required",
  SHORT_DESCRIPTION_REQUIRED: "tenders.errors.shortDescriptionRequired",
  FULL_DESCRIPTION_REQUIRED: "tenders.errors.fullDescriptionRequired",
  SCOPE_REQUIRED: "tenders.errors.scopeRequired",
  BUDGET_REQUIRED: "tenders.errors.budgetRequired",
  LOCATION_REQUIRED: "tenders.errors.locationRequired",
  DEADLINE_REQUIRED: "tenders.errors.deadlineRequired",
  DEADLINE_NOT_FUTURE: "tenders.errors.deadlineNotFuture",
};

function isAuthError(error: TenderErrorCode): error is AuthError {
  return Object.hasOwn(AUTH_STATUS_BY_ERROR, error);
}

export function mapTenderError(error: TenderErrorCode): Response {
  const status = isAuthError(error)
    ? AUTH_STATUS_BY_ERROR[error]
    : TENDER_STATUS_BY_ERROR[error];
  return Response.json(
    { code: error, messageKey: TENDER_ERROR_MESSAGE_KEYS[error] },
    { status },
  );
}
