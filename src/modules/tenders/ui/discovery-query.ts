import type { SearchPublishedTendersQuery } from "../application/search-published-tenders";
import { parseGeorgiaDateTimeLocal } from "./georgia-date-time";

export const discoveryFilterKeys = [
  "specialty",
  "city",
  "minBudget",
  "maxBudget",
  "deadlineBefore",
] as const;
export type DiscoveryFilterKey = (typeof discoveryFilterKeys)[number];

export const MAX_DISCOVERY_BUDGET_MINOR_UNITS = 2_147_483_647;

export type DiscoverySearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

export type DiscoveryFilterValues = Readonly<
  Record<DiscoveryFilterKey, string>
>;

type QueryParseResult =
  | Readonly<{ ok: true; value: SearchPublishedTendersQuery }>
  | Readonly<{ ok: false; fields: readonly DiscoveryFilterKey[] }>;

function readSingle(
  searchParams: DiscoverySearchParams,
  key: DiscoveryFilterKey,
): Readonly<{ ok: true; value: string | undefined }> | Readonly<{ ok: false }> {
  const value = searchParams[key];
  return value === undefined || typeof value === "string"
    ? { ok: true, value }
    : { ok: false };
}

export function majorUnitsToMinorUnits(value: string) {
  const normalized = value.trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return null;

  const whole = BigInt(match[1] ?? "");
  const fraction = BigInt((match[2] ?? "").padEnd(2, "0"));
  const minorUnits = whole * BigInt(100) + fraction;

  return minorUnits <= BigInt(MAX_DISCOVERY_BUDGET_MINOR_UNITS)
    ? Number(minorUnits)
    : null;
}

function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return parseGeorgiaDateTimeLocal(`${value}T00:00`);
}

export function parseDiscoverySearchParams(
  searchParams: DiscoverySearchParams,
): QueryParseResult {
  const specialtyParam = readSingle(searchParams, "specialty");
  const cityParam = readSingle(searchParams, "city");
  const minBudgetParam = readSingle(searchParams, "minBudget");
  const maxBudgetParam = readSingle(searchParams, "maxBudget");
  const deadlineParam = readSingle(searchParams, "deadlineBefore");

  if (!specialtyParam.ok) return { ok: false, fields: ["specialty"] };
  if (!cityParam.ok) return { ok: false, fields: ["city"] };
  if (!minBudgetParam.ok) return { ok: false, fields: ["minBudget"] };
  if (!maxBudgetParam.ok) return { ok: false, fields: ["maxBudget"] };
  if (!deadlineParam.ok) return { ok: false, fields: ["deadlineBefore"] };

  const specialtyValue = specialtyParam.value?.trim();
  if (specialtyValue && specialtyValue !== "CONSTRUCTION_REPAIR") {
    return { ok: false, fields: ["specialty"] };
  }
  const specialty = specialtyValue
    ? ("CONSTRUCTION_REPAIR" as const)
    : undefined;

  const city = cityParam.value?.trim();
  const minBudget = minBudgetParam.value?.trim();
  const maxBudget = maxBudgetParam.value?.trim();
  const deadlineValue = deadlineParam.value?.trim();
  const minBudgetMinorUnits = minBudget
    ? majorUnitsToMinorUnits(minBudget)
    : undefined;
  const maxBudgetMinorUnits = maxBudget
    ? majorUnitsToMinorUnits(maxBudget)
    : undefined;
  const deadlineBefore = deadlineValue
    ? parseDateOnly(deadlineValue)
    : undefined;
  const invalidFields: DiscoveryFilterKey[] = [];

  if (city && city.length > 120) invalidFields.push("city");
  if (minBudget && minBudgetMinorUnits === null)
    invalidFields.push("minBudget");
  if (maxBudget && maxBudgetMinorUnits === null)
    invalidFields.push("maxBudget");
  if (deadlineValue && deadlineBefore === null)
    invalidFields.push("deadlineBefore");
  if (
    minBudgetMinorUnits !== undefined &&
    minBudgetMinorUnits !== null &&
    maxBudgetMinorUnits !== undefined &&
    maxBudgetMinorUnits !== null &&
    minBudgetMinorUnits > maxBudgetMinorUnits
  ) {
    invalidFields.push("minBudget", "maxBudget");
  }
  if (invalidFields.length > 0) {
    return { ok: false, fields: [...new Set(invalidFields)] };
  }

  return {
    ok: true,
    value: {
      ...(specialty ? { specialty } : {}),
      ...(city ? { city } : {}),
      ...(minBudgetMinorUnits !== undefined && minBudgetMinorUnits !== null
        ? { minBudgetMinorUnits }
        : {}),
      ...(maxBudgetMinorUnits !== undefined && maxBudgetMinorUnits !== null
        ? { maxBudgetMinorUnits }
        : {}),
      ...(deadlineBefore ? { deadlineBefore } : {}),
    },
  };
}

export function serializeDiscoveryFilters(
  pathname: string,
  currentSearchParams: Pick<URLSearchParams, "toString">,
  values: DiscoveryFilterValues,
) {
  const nextSearchParams = new URLSearchParams(currentSearchParams.toString());
  for (const key of discoveryFilterKeys) nextSearchParams.delete(key);

  for (const key of discoveryFilterKeys) {
    const value = values[key].trim();
    if (value) nextSearchParams.set(key, value);
  }

  const query = nextSearchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}
