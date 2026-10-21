export const OUTBOX_TOPICS = {
  tenderWinnerSelected: "TENDER_WINNER_SELECTED",
  bidWon: "BID_WON",
  bidLost: "BID_LOST",
  tenderExpiredNoBids: "TENDER_EXPIRED_NO_BIDS",
  tenderAwaitingSelection: "TENDER_AWAITING_SELECTION",
  tenderReopenedForSelection: "TENDER_REOPENED_FOR_SELECTION",
  tenderSelectionExpired: "TENDER_SELECTION_EXPIRED",
  tenderExpiredNoOffersLeft: "TENDER_EXPIRED_NO_OFFERS_LEFT",
  tenderReopenedForBidding: "TENDER_REOPENED_FOR_BIDDING",
  agreementPartyConfirmed: "AGREEMENT_PARTY_CONFIRMED",
  agreementAgreed: "AGREEMENT_AGREED",
  agreementDeclined: "AGREEMENT_DECLINED",
  agreementExpired: "AGREEMENT_EXPIRED",
  workStartAcknowledged: "WORK_START_ACKNOWLEDGED",
  workStarted: "WORK_STARTED",
  completionConfirmed: "COMPLETION_CONFIRMED",
  agreementCompleted: "AGREEMENT_COMPLETED",
  agreementCancelled: "AGREEMENT_CANCELLED",
  reviewPublished: "REVIEW_PUBLISHED",
  reviewRedacted: "REVIEW_REDACTED",
} as const;

export type OutboxTopic = (typeof OUTBOX_TOPICS)[keyof typeof OUTBOX_TOPICS];

export type NotificationDraft = Readonly<{
  recipientId: string;
  topic: OutboxTopic;
  aggregateType: "Tender" | "Agreement" | "Review";
  aggregateId: string;
  messageKey: `notifications.${string}`;
  variables: Readonly<Record<string, string | number | null>>;
}>;
