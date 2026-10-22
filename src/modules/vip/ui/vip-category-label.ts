import type { Messages } from "../../localization/get-messages";
import type { VipSpecialty } from "../domain/partner";

/**
 * The Discover tenders category labels, reused for the All partners filter and
 * the card tags so both pages name a category the same way.
 */
export function vipCategoryLabel(
  specialty: VipSpecialty,
  messages: Messages,
): string {
  const labels: Readonly<Record<VipSpecialty, string>> = {
    CONSTRUCTION_REPAIR: messages.tenders.specialtyConstructionRepair,
    TRANSPORT: messages.tenders.specialtyTransport,
    EQUIPMENT: messages.tenders.specialtyEquipment,
    DAILY_LABOR: messages.tenders.specialtyDailyLabor,
    MATERIAL_SUPPLIER: messages.tenders.specialtyMaterialSupplier,
  };
  return labels[specialty];
}
