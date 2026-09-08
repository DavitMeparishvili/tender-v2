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
    serviceCode: tender.serviceCode,
    title: tender.title,
    shortDescription: tender.shortDescription ?? "",
    fullDescription: tender.fullDescription ?? "",
    scopeOfWork: tender.scopeOfWork ?? "",
    workItems: tender.workItems ?? [],
    areaSquareMeters: tender.areaSquareMeters?.toString() ?? "",
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
    // The stored mode, never a guess from the presence of coordinates: every
    // located draft has coordinates (an address is geocoded into a pair), so
    // guessing opened every resumed draft in PIN mode and made step 3 replace
    // the client's street address with a reverse-geocoded label.
    locationMode: location?.mode ?? "ADDRESS",
    placeId: location?.placeId ? String(location.placeId) : "",
    city: location?.city ?? "",
    district: location?.district ?? "",
    addressLine: location?.addressLine ?? "",
    latitude: location ? String(location.exact.latitude) : "",
    longitude: location ? String(location.exact.longitude) : "",
    attachmentNames,
  };
}
