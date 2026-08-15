import type { Messages } from "../../localization/get-messages";
import type { CancelTenderCopy } from "./cancel-tender-form";
import type { LocationMapCopy } from "./location-map";
import type { PublishTenderCopy } from "./publish-tender-form";

export function locationMapCopy(messages: Messages): LocationMapCopy {
  return {
    interactiveLabel: messages.tenders.mapInteractiveLabel,
    preciseLabel: messages.tenders.mapPreciseLabel,
    approximateLabel: messages.tenders.mapApproximateLabel,
  };
}

export function publishTenderCopy(messages: Messages): PublishTenderCopy {
  return {
    label: messages.tenders.publish,
    pendingLabel: messages.tenders.publishing,
    hint: messages.tenders.publishHint,
    success: messages.tenders.statusPublished,
    summaryOne: messages.errors.summaryOne,
    summaryMany: messages.errors.summaryMany,
    genericError: messages.errors.generic,
    requiredError: messages.errors.required,
    shortDescriptionRequired: messages.tenders.errors.shortDescriptionRequired,
    fullDescriptionRequired: messages.tenders.errors.fullDescriptionRequired,
    scopeRequired: messages.tenders.errors.scopeRequired,
    budgetRequired: messages.tenders.errors.budgetRequired,
    locationRequired: messages.tenders.errors.locationRequired,
    deadlineRequired: messages.tenders.errors.deadlineRequired,
    deadlineNotFuture: messages.tenders.errors.deadlineNotFuture,
    notFound: messages.tenders.errors.notFound,
    notOwner: messages.tenders.errors.notOwner,
    unavailable: messages.tenders.publishUnavailable,
  };
}

export function cancelTenderCopy(messages: Messages): CancelTenderCopy {
  return {
    label: messages.tenders.cancel,
    pendingLabel: messages.tenders.cancelling,
    reasonLabel: messages.tenders.cancelReason,
    reasonHint: messages.tenders.cancelReasonHint,
    success: messages.tenders.statusCancelled,
    summaryOne: messages.errors.summaryOne,
    summaryMany: messages.errors.summaryMany,
    requiredError: messages.errors.required,
    invalidError: messages.tenders.errors.invalidInput,
    notFound: messages.tenders.errors.notFound,
    notOwner: messages.tenders.errors.notOwner,
    alreadyCancelled: messages.tenders.errors.alreadyCancelled,
    genericError: messages.errors.generic,
  };
}
