import type { TenderDraft } from "../domain/tender";
import type { TenderWizardFormState } from "./tender-wizard";
import {
  formatDateInputValue,
  formatGeorgiaDateTimeLocal,
} from "./georgia-date-time";

export function tenderToWizardForm(
  tender: TenderDraft,
  attachmentNames: readonly string[] = [],
): TenderWizardFormState {
  const location = tender.location;

  return {
    specialty: tender.specialty,
    title: tender.title,
    shortDescription: tender.shortDescription ?? "",
    fullDescription: tender.fullDescription ?? "",
    scopeOfWork: tender.scopeOfWork ?? "",
    budget:
      tender.budgetMinorUnits === null
        ? ""
        : (tender.budgetMinorUnits / 100).toFixed(2),
    currency: tender.currency ?? "GEL",
    deadline: formatGeorgiaDateTimeLocal(tender.deadline),
    desiredStartDate: formatDateInputValue(tender.desiredStartDate),
    workerNotes: tender.workerNotes ?? "",
    equipmentNotes: tender.equipmentNotes ?? "",
    materialNotes: tender.materialNotes ?? "",
    conditions: tender.conditions ?? "",
    locationMode: location ? "PIN" : "ADDRESS",
    city: location?.city ?? "",
    district: location?.district ?? "",
    addressLine: location?.addressLine ?? "",
    latitude: location ? String(location.exact.latitude) : "",
    longitude: location ? String(location.exact.longitude) : "",
    attachmentNames,
  };
}
