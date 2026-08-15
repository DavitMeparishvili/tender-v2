import type { TenderDraft } from "../domain/tender";
import type { TenderWizardFormState } from "./tender-wizard";

function dateTimeLocalValue(value: Date | null) {
  if (value === null) return "";

  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Tbilisi",
  })
    .format(value)
    .replace(" ", "T");
}

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
    deadline: dateTimeLocalValue(tender.deadline),
    desiredStartDate: dateTimeLocalValue(tender.desiredStartDate),
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
