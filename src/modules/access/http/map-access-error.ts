import type { AuthError } from "../../identity/application/require-capability";
import type { Messages } from "../../localization/get-messages";
import type { ConfirmCheckoutError } from "../application/confirm-access-checkout";
import type { StartCheckoutError } from "../application/start-access-checkout";

export type AccessErrorCode =
  AuthError | StartCheckoutError | ConfirmCheckoutError;

type MessageKey<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${MessageKey<T[K]>}`;
}[keyof T & string];

// Same exhaustiveness guarantee as `src/modules/tenders/http/map-tender-error.ts`:
// typed as a total `Record`, so a new `AuthError` member fails to compile here
// until it is given a status.
const AUTH_STATUS_BY_ERROR: Readonly<Record<AuthError, number>> = {
  UNAUTHENTICATED: 401,
  EMAIL_UNVERIFIED: 403,
  ONBOARDING_INCOMPLETE: 403,
  ACCOUNT_DISABLED: 403,
  ACCOUNT_RESTRICTED: 403,
  CAPABILITY_MISSING: 403,
};

const ACCESS_STATUS_BY_ERROR: Readonly<
  Record<Exclude<AccessErrorCode, AuthError>, number>
> = {
  INVALID_INPUT: 400,
  TENDER_REQUIRED: 400,
  TENDER_NOT_ALLOWED: 400,
  TENDER_NOT_FOUND: 404,
  ALREADY_ENTITLED: 409,
  CHECKOUT_NOT_FOUND: 404,
  NOT_CHECKOUT_OWNER: 403,
  // 402 Payment Required is the accurate status for a declined payment, and
  // it keeps a declined charge distinguishable from a validation failure in
  // logs and in the client's error branch.
  PAYMENT_FAILED: 402,
};

export const ACCESS_ERROR_MESSAGE_KEYS: Readonly<
  Record<AccessErrorCode, MessageKey<Messages>>
> = {
  UNAUTHENTICATED: "access.unauthenticated",
  EMAIL_UNVERIFIED: "access.emailUnverified",
  ONBOARDING_INCOMPLETE: "access.onboardingIncomplete",
  ACCOUNT_DISABLED: "access.accountDisabled",
  ACCOUNT_RESTRICTED: "access.accountRestricted",
  CAPABILITY_MISSING: "access.capabilityMissing",
  INVALID_INPUT: "errors.invalidInput",
  TENDER_REQUIRED: "entitlements.errors.tenderRequired",
  TENDER_NOT_ALLOWED: "entitlements.errors.tenderNotAllowed",
  TENDER_NOT_FOUND: "tenders.errors.notFound",
  ALREADY_ENTITLED: "entitlements.errors.alreadyEntitled",
  CHECKOUT_NOT_FOUND: "entitlements.errors.checkoutNotFound",
  NOT_CHECKOUT_OWNER: "entitlements.errors.notCheckoutOwner",
  PAYMENT_FAILED: "entitlements.errors.paymentFailed",
};

function isAuthError(error: AccessErrorCode): error is AuthError {
  return Object.hasOwn(AUTH_STATUS_BY_ERROR, error);
}

export function mapAccessError(error: AccessErrorCode): Response {
  const status = isAuthError(error)
    ? AUTH_STATUS_BY_ERROR[error]
    : ACCESS_STATUS_BY_ERROR[error];
  return Response.json(
    { code: error, messageKey: ACCESS_ERROR_MESSAGE_KEYS[error] },
    { status },
  );
}
