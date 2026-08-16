// `Bid.amountMinorUnits` is a Postgres INTEGER (INT4) column, so a larger
// amount would overflow on write and surface as a driver error rather than a
// validation failure — the same ceiling and the same reasoning as
// `MAX_BUDGET_MINOR_UNITS` in the tenders module.
export const MAX_BID_AMOUNT_MINOR_UNITS = 2_147_483_647;

// The program design requires a "substantive conditions note" without fixing
// a length. This reuses the platform's only existing substantive-text bar,
// the 30-character review comment rule, rather than inventing a second one.
export const MIN_BID_CONDITIONS_LENGTH = 30;
export const MAX_BID_CONDITIONS_LENGTH = 4_000;
export const MAX_BID_TERM_LENGTH = 2_000;
export const MAX_BID_DURATION_DAYS = 3_650;
