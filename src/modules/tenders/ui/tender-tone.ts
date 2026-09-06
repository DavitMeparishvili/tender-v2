import type { TenderSpecialty } from "../domain/service-taxonomy";
import type { TenderStatus } from "../domain/tender";

/**
 * Category tags carry a tone so a scanning eye can group results, but the tone
 * is decoration on top of the label — the category is always spelled out, so
 * nothing is communicated by colour alone.
 */
const specialtyTones: Readonly<Record<TenderSpecialty, string>> = {
  CONSTRUCTION_REPAIR: "tag-blue",
  TRANSPORT: "tag-green",
  EQUIPMENT: "tag-grey",
  DAILY_LABOR: "tag-violet",
  MATERIAL_SUPPLIER: "tag-emerald",
};

export function specialtyTone(specialty: TenderSpecialty): string {
  return `tag ${specialtyTones[specialty]}`;
}

const statusTones: Readonly<Record<TenderStatus, string>> = {
  DRAFT: "tag-emerald",
  PUBLISHED: "tag-green",
  CLOSED: "tag-grey",
  EXPIRED: "tag-red",
  CANCELLED: "tag-red",
};

export function statusTone(status: TenderStatus): string {
  return `tag ${statusTones[status]}`;
}

/** Names are a subset of the design system's icon set (see `BrandIcon`). */
export type SpecialtyIconName =
  "buildings" | "target" | "settings" | "people" | "invoice";

const specialtyIcons: Readonly<Record<TenderSpecialty, SpecialtyIconName>> = {
  CONSTRUCTION_REPAIR: "buildings",
  TRANSPORT: "target",
  EQUIPMENT: "settings",
  DAILY_LABOR: "people",
  MATERIAL_SUPPLIER: "invoice",
};

export function specialtyIcon(specialty: TenderSpecialty): SpecialtyIconName {
  return specialtyIcons[specialty];
}
