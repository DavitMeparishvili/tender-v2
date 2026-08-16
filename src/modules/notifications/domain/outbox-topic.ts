export const OUTBOX_TOPICS = {
  tenderWinnerSelected: "TENDER_WINNER_SELECTED",
  bidWon: "BID_WON",
  bidLost: "BID_LOST",
  tenderExpiredNoBids: "TENDER_EXPIRED_NO_BIDS",
} as const;

export type OutboxTopic = (typeof OUTBOX_TOPICS)[keyof typeof OUTBOX_TOPICS];

export type OutboxDraft = Readonly<{
  topic: OutboxTopic;
  aggregateId: string;
  payload: Readonly<Record<string, string | number | null>>;
}>;
