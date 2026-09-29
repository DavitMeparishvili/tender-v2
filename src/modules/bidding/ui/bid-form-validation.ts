import type { FormIssue } from "../../identity/ui/identity-form";
import { parseDateInputValue } from "../../tenders/ui/georgia-date-time";
import {
  MAX_BID_AMOUNT_MINOR_UNITS,
  MAX_BID_CONDITIONS_LENGTH,
  MAX_BID_DURATION_DAYS,
  MAX_BID_TERM_LENGTH,
  MIN_BID_CONDITIONS_LENGTH,
} from "../domain/constraints";

export type BidValidationCopy = Readonly<{
  amount: string;
  duration: string;
  conditions: string;
  date: string;
  term: string;
}>;

export function bidAmountMinorUnits(raw: string): number | null {
  const match = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(raw.trim());
  if (!match) return null;
  const amount =
    Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return amount > 0 && amount <= MAX_BID_AMOUNT_MINOR_UNITS ? amount : null;
}

export function validateBidForm(
  data: FormData,
  amount: string,
  copy: BidValidationCopy,
): FormIssue[] {
  const issues: FormIssue[] = [];
  if (bidAmountMinorUnits(amount) === null) {
    issues.push({ field: "bid-amount", message: copy.amount });
  }
  const duration = Number(data.get("durationDays"));
  if (
    !Number.isInteger(duration) ||
    duration < 1 ||
    duration > MAX_BID_DURATION_DAYS
  ) {
    issues.push({ field: "bid-duration", message: copy.duration });
  }
  const conditions = String(data.get("conditions") ?? "").trim();
  if (
    conditions.length < MIN_BID_CONDITIONS_LENGTH ||
    conditions.length > MAX_BID_CONDITIONS_LENGTH
  ) {
    issues.push({ field: "bid-conditions", message: copy.conditions });
  }
  const date = String(data.get("proposedStartDate") ?? "");
  if (date && parseDateInputValue(date) === null) {
    issues.push({ field: "bid-start", message: copy.date });
  }
  for (const [name, field] of [
    ["includedCosts", "bid-included"],
    ["exclusions", "bid-exclusions"],
  ]) {
    if (String(data.get(name!) ?? "").trim().length > MAX_BID_TERM_LENGTH) {
      issues.push({ field: field!, message: copy.term });
    }
  }
  return issues;
}
