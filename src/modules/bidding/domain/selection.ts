import type { BidTenderTerms, RankableBid } from "./bid";
import { bidIneligibility } from "./bid-eligibility";

const DAY_MS = 24 * 60 * 60 * 1000;

// How long the client has to choose a contractor once bidding closes (and
// again after a pending agreement is declined). The tender expires when the
// window ends without a choice.
export const SELECTION_WINDOW_DAYS = 14;

// The client chooses the contractor; the platform never does. These rules say
// which offers the client MAY choose and for how long — nothing here ranks a
// winner.

// A bid can be chosen while it is still an active, valid offer: submitted (not
// withdrawn, not already settled) and eligible against the tender's terms.
export function isChoosableBid(
  bid: RankableBid,
  terms: BidTenderTerms,
): boolean {
  return bid.status === "SUBMITTED" && bidIneligibility(bid, terms) === null;
}

export function choosableBids<T extends RankableBid>(
  bids: readonly T[],
  terms: BidTenderTerms,
): readonly T[] {
  return bids.filter((bid) => isChoosableBid(bid, terms));
}

export function addSelectionWindow(from: Date, windowDays: number): Date {
  return new Date(from.getTime() + windowDays * DAY_MS);
}

// The window the deadline sweep stamps when it moves a tender into
// selection: `deadline + N` days, or — when the sweep only reaches the tender
// after that has already passed — a full `N` days from the sweep itself, so
// the client is never given a window that is already over.
export function selectionWindowFromSweep(
  deadline: Date,
  now: Date,
  windowDays: number,
): Date {
  const fromDeadline = addSelectionWindow(deadline, windowDays);
  return fromDeadline.getTime() > now.getTime()
    ? fromDeadline
    : addSelectionWindow(now, windowDays);
}

export type SelectionState = Readonly<{
  status: string;
  selectionExpiresAt: Date | null;
}>;

// Whether the client may choose right now. While bidding is PUBLISHED (before
// or after its deadline, until the sweep stamps a window) the client may
// always choose; once AWAITING_SELECTION, only until the stamped window ends.
// The client page and the choose use case both ask this one question.
export function isSelectionOpen(tender: SelectionState, now: Date): boolean {
  if (tender.status === "PUBLISHED") return true;
  if (tender.status !== "AWAITING_SELECTION") return false;
  return (
    tender.selectionExpiresAt === null ||
    tender.selectionExpiresAt.getTime() > now.getTime()
  );
}

// The "choose by" date to show the client: the stamped window, or — once the
// deadline has passed but before the sweep stamps it — the window the sweep
// will stamp. Null while bidding is still running.
export function displayedSelectionEnd(
  tender: SelectionState & Readonly<{ deadline: Date }>,
  now: Date,
  windowDays: number,
): Date | null {
  if (tender.status === "AWAITING_SELECTION") return tender.selectionExpiresAt;
  if (tender.status !== "PUBLISHED") return null;
  if (tender.deadline.getTime() > now.getTime()) return null;
  return selectionWindowFromSweep(tender.deadline, now, windowDays);
}
