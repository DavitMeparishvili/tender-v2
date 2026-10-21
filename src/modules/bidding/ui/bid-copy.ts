import type { Messages } from "../../localization/get-messages";
import type { BiddingErrorCode } from "../http/map-bidding-error";
import type { BidFormCopy } from "./bid-form";

export function bidFormCopy(messages: Messages): BidFormCopy {
  const errorsByCode: Record<BiddingErrorCode, string> = {
    UNAUTHENTICATED: messages.access.unauthenticated,
    EMAIL_UNVERIFIED: messages.access.emailUnverified,
    ONBOARDING_INCOMPLETE: messages.access.onboardingIncomplete,
    ACCOUNT_DISABLED: messages.access.accountDisabled,
    ACCOUNT_RESTRICTED: messages.access.accountRestricted,
    CAPABILITY_MISSING: messages.access.capabilityMissing,
    INVALID_INPUT: messages.errors.invalidInput,
    TENDER_NOT_FOUND: messages.tenders.errors.notFound,
    TENDER_NOT_OPEN: messages.bidding.errors.tenderNotOpen,
    DEADLINE_PASSED: messages.bidding.errors.deadlinePassed,
    NOT_ENTITLED: messages.entitlements.errors.notEntitled,
    OWN_TENDER: messages.bidding.errors.ownTender,
    BID_ALREADY_EXISTS: messages.bidding.errors.bidAlreadyExists,
    BID_NOT_FOUND: messages.bidding.errors.bidNotFound,
    BID_NOT_ACTIVE: messages.bidding.errors.bidNotActive,
    NOT_OWNER: messages.tenders.errors.notOwner,
    TENDER_NOT_SELECTABLE: messages.bidding.errors.tenderNotSelectable,
    BID_NOT_SELECTABLE: messages.bidding.errors.bidNotSelectable,
  };

  return {
    cancel: messages.bidding.offer.cancel,
    amount: messages.bidding.amount,
    amountHint: messages.bidding.amountHint,
    proposedStartDate: messages.bidding.proposedStartDate,
    durationDays: messages.bidding.durationDays,
    includedCosts: messages.bidding.includedCosts,
    exclusions: messages.bidding.exclusions,
    conditions: messages.bidding.conditions,
    conditionsHint: messages.bidding.conditionsHint,
    optional: messages.common.optional,
    required: messages.common.required,
    durationHint: messages.bidding.durationHint,
    validation: messages.bidding.validation,
    submit: messages.bidding.submit,
    submitting: messages.bidding.submitting,
    revise: messages.bidding.revise,
    revising: messages.bidding.revising,
    withdraw: messages.bidding.withdraw,
    withdrawing: messages.bidding.withdrawing,
    submitted: messages.bidding.submitted,
    revised: messages.bidding.revised,
    withdrawn: messages.bidding.withdrawn,
    selectionRule: messages.bidding.selectionRule,
    revisionResetsQueue: messages.bidding.revisionResetsQueue,
    summaryOne: messages.errors.summaryOne,
    summaryMany: messages.errors.summaryMany,
    genericError: messages.errors.generic,
    errorsByCode,
  };
}
