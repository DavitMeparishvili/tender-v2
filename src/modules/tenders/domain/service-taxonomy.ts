export const TENDER_SPECIALTIES = [
  "CONSTRUCTION_REPAIR",
  "TRANSPORT",
  "EQUIPMENT",
  "DAILY_LABOR",
  "MATERIAL_SUPPLIER",
] as const;

export type TenderSpecialty = (typeof TENDER_SPECIALTIES)[number];

export const TENDER_SERVICES = [
  { code: "GENERAL_CONSTRUCTION", specialty: "CONSTRUCTION_REPAIR" },
  { code: "RENOVATION_REMODELING", specialty: "CONSTRUCTION_REPAIR" },
  { code: "ARCHITECTURE_DESIGN", specialty: "CONSTRUCTION_REPAIR" },
  { code: "DEMOLITION_DISMANTLING", specialty: "CONSTRUCTION_REPAIR" },
  { code: "EARTHWORKS_EXCAVATION", specialty: "CONSTRUCTION_REPAIR" },
  { code: "FOUNDATION_WORK", specialty: "CONSTRUCTION_REPAIR" },
  {
    code: "CONCRETE_REINFORCED_CONCRETE",
    specialty: "CONSTRUCTION_REPAIR",
  },
  { code: "MASONRY_BLOCK_BRICK", specialty: "CONSTRUCTION_REPAIR" },
  { code: "ROOFING", specialty: "CONSTRUCTION_REPAIR" },
  { code: "FACADE_INSULATION", specialty: "CONSTRUCTION_REPAIR" },
  { code: "WATERPROOFING", specialty: "CONSTRUCTION_REPAIR" },
  { code: "CARPENTRY_JOINERY", specialty: "CONSTRUCTION_REPAIR" },
  { code: "METALWORK_WELDING", specialty: "CONSTRUCTION_REPAIR" },
  { code: "ELECTRICAL_INSTALLATION", specialty: "CONSTRUCTION_REPAIR" },
  { code: "PLUMBING", specialty: "CONSTRUCTION_REPAIR" },
  {
    code: "HEATING_COOLING_VENTILATION",
    specialty: "CONSTRUCTION_REPAIR",
  },
  { code: "DRYWALL_PLASTERING", specialty: "CONSTRUCTION_REPAIR" },
  { code: "PAINTING_DECORATING", specialty: "CONSTRUCTION_REPAIR" },
  { code: "TILING_STONEWORK", specialty: "CONSTRUCTION_REPAIR" },
  { code: "FLOORING", specialty: "CONSTRUCTION_REPAIR" },
  { code: "WINDOWS_DOORS", specialty: "CONSTRUCTION_REPAIR" },
  { code: "LOW_VOLTAGE_SECURITY", specialty: "CONSTRUCTION_REPAIR" },
  {
    code: "LANDSCAPING_EXTERNAL_WORKS",
    specialty: "CONSTRUCTION_REPAIR",
  },
  {
    code: "OTHER_CONSTRUCTION_REPAIR",
    specialty: "CONSTRUCTION_REPAIR",
  },

  { code: "CONSTRUCTION_MATERIAL_DELIVERY", specialty: "TRANSPORT" },
  { code: "GENERAL_CARGO_TRANSPORT", specialty: "TRANSPORT" },
  { code: "WASTE_DEBRIS_REMOVAL", specialty: "TRANSPORT" },
  { code: "SOIL_INERT_MATERIAL_TRANSPORT", specialty: "TRANSPORT" },
  { code: "FURNITURE_APPLIANCE_MOVING", specialty: "TRANSPORT" },
  { code: "HEAVY_OVERSIZED_HAULAGE", specialty: "TRANSPORT" },
  { code: "SPECIAL_PURPOSE_TRANSPORT", specialty: "TRANSPORT" },
  { code: "OTHER_TRANSPORT", specialty: "TRANSPORT" },

  { code: "EXCAVATOR", specialty: "EQUIPMENT" },
  { code: "MINI_EXCAVATOR", specialty: "EQUIPMENT" },
  { code: "BULLDOZER", specialty: "EQUIPMENT" },
  { code: "MOBILE_CRANE", specialty: "EQUIPMENT" },
  { code: "CONCRETE_PUMP", specialty: "EQUIPMENT" },
  { code: "DUMP_TRUCK", specialty: "EQUIPMENT" },
  { code: "WHEEL_LOADER", specialty: "EQUIPMENT" },
  { code: "FORKLIFT", specialty: "EQUIPMENT" },
  { code: "GRADER", specialty: "EQUIPMENT" },
  { code: "ROAD_ROLLER_COMPACTOR", specialty: "EQUIPMENT" },
  { code: "MANIPULATOR_CRANE_TRUCK", specialty: "EQUIPMENT" },
  { code: "AERIAL_WORK_PLATFORM", specialty: "EQUIPMENT" },
  { code: "DRILLING_RIG", specialty: "EQUIPMENT" },
  { code: "GENERATOR_COMPRESSOR", specialty: "EQUIPMENT" },
  { code: "SCAFFOLDING_FORMWORK", specialty: "EQUIPMENT" },
  { code: "OTHER_CONSTRUCTION_EQUIPMENT", specialty: "EQUIPMENT" },

  { code: "GENERAL_DAY_LABOR", specialty: "DAILY_LABOR" },
  { code: "LOADERS_MATERIAL_HANDLERS", specialty: "DAILY_LABOR" },
  { code: "DEMOLITION_CREW", specialty: "DAILY_LABOR" },
  { code: "EARTHWORK_CREW", specialty: "DAILY_LABOR" },
  { code: "CONCRETE_CREW_HELPERS", specialty: "DAILY_LABOR" },
  { code: "SITE_CLEANUP", specialty: "DAILY_LABOR" },
  { code: "WAREHOUSE_LABOR", specialty: "DAILY_LABOR" },
  { code: "OTHER_LABOR", specialty: "DAILY_LABOR" },

  { code: "CEMENT_DRY_MIXES", specialty: "MATERIAL_SUPPLIER" },
  { code: "REINFORCEMENT_STEEL", specialty: "MATERIAL_SUPPLIER" },
  { code: "READY_MIX_CONCRETE", specialty: "MATERIAL_SUPPLIER" },
  { code: "BLOCKS_BRICKS", specialty: "MATERIAL_SUPPLIER" },
  { code: "METAL_PROFILES", specialty: "MATERIAL_SUPPLIER" },
  { code: "TIMBER_WOOD", specialty: "MATERIAL_SUPPLIER" },
  {
    code: "DRYWALL_PLASTER_MATERIALS",
    specialty: "MATERIAL_SUPPLIER",
  },
  { code: "PAINT_COATINGS", specialty: "MATERIAL_SUPPLIER" },
  { code: "PLUMBING_MATERIALS", specialty: "MATERIAL_SUPPLIER" },
  { code: "ELECTRICAL_MATERIALS", specialty: "MATERIAL_SUPPLIER" },
  { code: "ROOFING_MATERIALS", specialty: "MATERIAL_SUPPLIER" },
  { code: "FINISHING_TILES_STONE", specialty: "MATERIAL_SUPPLIER" },
  { code: "INSULATION_MATERIALS", specialty: "MATERIAL_SUPPLIER" },
  { code: "SAND_GRAVEL_INERT", specialty: "MATERIAL_SUPPLIER" },
  {
    code: "WINDOWS_DOORS_MATERIALS",
    specialty: "MATERIAL_SUPPLIER",
  },
  {
    code: "OTHER_CONSTRUCTION_MATERIALS",
    specialty: "MATERIAL_SUPPLIER",
  },
] as const satisfies readonly Readonly<{
  code: string;
  specialty: TenderSpecialty;
}>[];

export type TenderServiceCode = (typeof TENDER_SERVICES)[number]["code"];

const specialtySet = new Set<string>(TENDER_SPECIALTIES);
const serviceByCode = new Map<string, TenderSpecialty>(
  TENDER_SERVICES.map(({ code, specialty }) => [code, specialty]),
);

export function isTenderSpecialty(value: string): value is TenderSpecialty {
  return specialtySet.has(value);
}

export function isTenderServiceCode(value: string): value is TenderServiceCode {
  return serviceByCode.has(value);
}

export function specialtyForService(
  serviceCode: TenderServiceCode,
): TenderSpecialty {
  return serviceByCode.get(serviceCode)!;
}

export function isServiceForSpecialty(
  serviceCode: TenderServiceCode,
  specialty: TenderSpecialty,
) {
  return specialtyForService(serviceCode) === specialty;
}

export function servicesForSpecialty(specialty: TenderSpecialty) {
  return TENDER_SERVICES.filter((service) => service.specialty === specialty);
}
