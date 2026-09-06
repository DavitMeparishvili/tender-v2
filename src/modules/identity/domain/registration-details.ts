export const ID_NUMBER_PATTERN = /^(?:\d{9}|\d{11})$/;
export const CITY_OR_TOWN_MIN_LENGTH = 2;
export const CITY_OR_TOWN_MAX_LENGTH = 120;
export const ADDRESS_MIN_LENGTH = 5;
export const ADDRESS_MAX_LENGTH = 240;

export function normalizeRegistrationAddress(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
