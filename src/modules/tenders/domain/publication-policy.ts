import type { Result } from "@/src/modules/shared";
import type { TenderDraft } from "./tender";

export type PublicationBlockingReason =
  | "TITLE_REQUIRED"
  | "SHORT_DESCRIPTION_REQUIRED"
  | "FULL_DESCRIPTION_REQUIRED"
  | "SCOPE_REQUIRED"
  | "BUDGET_REQUIRED"
  | "LOCATION_REQUIRED"
  | "DEADLINE_REQUIRED"
  | "DEADLINE_NOT_FUTURE";

export function evaluateDraftForPublication(
  draft: TenderDraft,
  now: Date,
): Result<void, PublicationBlockingReason> {
  if (draft.title.trim().length === 0) {
    return { ok: false, error: "TITLE_REQUIRED" };
  }
  if (!draft.shortDescription) {
    return { ok: false, error: "SHORT_DESCRIPTION_REQUIRED" };
  }
  if (!draft.fullDescription) {
    return { ok: false, error: "FULL_DESCRIPTION_REQUIRED" };
  }
  if (!draft.scopeOfWork) {
    return { ok: false, error: "SCOPE_REQUIRED" };
  }
  if (draft.budgetMinorUnits === null || draft.currency === null) {
    return { ok: false, error: "BUDGET_REQUIRED" };
  }
  if (!draft.location) {
    return { ok: false, error: "LOCATION_REQUIRED" };
  }
  if (!draft.deadline) {
    return { ok: false, error: "DEADLINE_REQUIRED" };
  }
  if (draft.deadline.getTime() <= now.getTime()) {
    return { ok: false, error: "DEADLINE_NOT_FUTURE" };
  }

  return { ok: true, value: undefined };
}
