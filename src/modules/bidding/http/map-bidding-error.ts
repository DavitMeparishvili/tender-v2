import type { AuthError } from "../../identity/application/require-capability";
import type { Messages } from "../../localization/get-messages";
import type { ReviseBidError } from "../application/revise-bid";
import type { SubmitBidError } from "../application/submit-bid";
import type { WithdrawBidError } from "../application/withdraw-bid";

export type BiddingErrorCode =
  AuthError | SubmitBidError | ReviseBidError | WithdrawBidError | "NOT_OWNER";

type MessageKey<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${MessageKey<T[K]>}`;
}[keyof T & string];

const AUTH_STATUS_BY_ERROR: Readonly<Record<AuthError, number>> = {
  UNAUTHENTICATED: 401,
  EMAIL_UNVERIFIED: 403,
  ONBOARDING_INCOMPLETE: 403,
  ACCOUNT_DISABLED: 403,
  ACCOUNT_RESTRICTED: 403,
  CAPABILITY_MISSING: 403,
};

const BIDDING_STATUS_BY_ERROR: Readonly<
  Record<Exclude<BiddingErrorCode, AuthError>, number>
> = {
  INVALID_INPUT: 400,
  TENDER_NOT_FOUND: 404,
  TENDER_NOT_OPEN: 409,
  DEADLINE_PASSED: 409,
  // Payment Required: the provider can resolve this by buying access, which
  // is materially different from a 403 they can never resolve.
  NOT_ENTITLED: 402,
  OWN_TENDER: 403,
  BID_ALREADY_EXISTS: 409,
  BID_NOT_FOUND: 404,
  BID_NOT_ACTIVE: 409,
  NOT_OWNER: 403,
};

export const BIDDING_ERROR_MESSAGE_KEYS: Readonly<
  Record<BiddingErrorCode, MessageKey<Messages>>
> = {
  UNAUTHENTICATED: "access.unauthenticated",
  EMAIL_UNVERIFIED: "access.emailUnverified",
  ONBOARDING_INCOMPLETE: "access.onboardingIncomplete",
  ACCOUNT_DISABLED: "access.accountDisabled",
  ACCOUNT_RESTRICTED: "access.accountRestricted",
  CAPABILITY_MISSING: "access.capabilityMissing",
  INVALID_INPUT: "errors.invalidInput",
  TENDER_NOT_FOUND: "tenders.errors.notFound",
  TENDER_NOT_OPEN: "bidding.errors.tenderNotOpen",
  DEADLINE_PASSED: "bidding.errors.deadlinePassed",
  NOT_ENTITLED: "entitlements.errors.notEntitled",
  OWN_TENDER: "bidding.errors.ownTender",
  BID_ALREADY_EXISTS: "bidding.errors.bidAlreadyExists",
  BID_NOT_FOUND: "bidding.errors.bidNotFound",
  BID_NOT_ACTIVE: "bidding.errors.bidNotActive",
  NOT_OWNER: "tenders.errors.notOwner",
};

function isAuthError(error: BiddingErrorCode): error is AuthError {
  return Object.hasOwn(AUTH_STATUS_BY_ERROR, error);
}

export function mapBiddingError(error: BiddingErrorCode): Response {
  const status = isAuthError(error)
    ? AUTH_STATUS_BY_ERROR[error]
    : BIDDING_STATUS_BY_ERROR[error];
  return Response.json(
    { code: error, messageKey: BIDDING_ERROR_MESSAGE_KEYS[error] },
    { status },
  );
}
