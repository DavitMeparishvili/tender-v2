// Phase 3 creates the snapshot and nothing else. The confirmation, decline,
// start, and completion transitions are Phase 4's; this module deliberately
// declares only the one status Phase 3 can produce, so an unimplemented
// transition cannot be written by accident.
export type AgreementStatus = "PENDING_CONFIRMATION";

// Program design §4.4: the selected provider and client each have 48 hours to
// confirm the snapshot.
export const AGREEMENT_CONFIRMATION_WINDOW_MS = 48 * 60 * 60 * 1000;

// The immutable record of the winning offer, stored as JSON so Phase 4 shows
// both parties exactly the terms that won rather than re-reading a bid row
// that could later change.
export type AgreementSnapshot = Readonly<{
  tenderId: string;
  tenderTitle: string;
  clientId: string;
  providerId: string;
  bidId: string;
  amountMinorUnits: number;
  currency: "GEL" | "USD";
  proposedStartDate: string | null;
  durationDays: number | null;
  includedCosts: string | null;
  exclusions: string | null;
  conditions: string;
}>;

export function confirmationDeadline(now: Date): Date {
  return new Date(now.getTime() + AGREEMENT_CONFIRMATION_WINDOW_MS);
}
