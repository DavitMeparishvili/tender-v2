import type { Messages } from "../../localization/get-messages";
import {
  TENDER_SPECIALTIES,
  servicesForSpecialty,
  type TenderServiceCode,
  type TenderSpecialty,
} from "../domain/service-taxonomy";

export function specialtyLabel(specialty: TenderSpecialty, messages: Messages) {
  const labels: Readonly<Record<TenderSpecialty, string>> = {
    CONSTRUCTION_REPAIR: messages.tenders.specialtyConstructionRepair,
    TRANSPORT: messages.tenders.specialtyTransport,
    EQUIPMENT: messages.tenders.specialtyEquipment,
    DAILY_LABOR: messages.tenders.specialtyDailyLabor,
    MATERIAL_SUPPLIER: messages.tenders.specialtyMaterialSupplier,
  };
  return labels[specialty];
}

export function serviceLabel(
  serviceCode: TenderServiceCode,
  messages: Messages,
) {
  return messages.tenders.serviceLabels[serviceCode];
}

export function localizedSpecialties(messages: Messages) {
  return TENDER_SPECIALTIES.map((value) => ({
    value,
    label: specialtyLabel(value, messages),
  }));
}

export function localizedServices(
  specialty: TenderSpecialty,
  messages: Messages,
) {
  return servicesForSpecialty(specialty).map(({ code }) => ({
    value: code,
    label: serviceLabel(code, messages),
  }));
}
