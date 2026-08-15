const GEORGIA_UTC_OFFSET_MILLISECONDS = 4 * 60 * 60 * 1000;
const dateInputPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const dateTimeLocalPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function validUtcParts(
  value: Date,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
) {
  return (
    value.getUTCFullYear() === year &&
    value.getUTCMonth() === month - 1 &&
    value.getUTCDate() === day &&
    value.getUTCHours() === hour &&
    value.getUTCMinutes() === minute
  );
}

export function parseDateInputValue(value: string): Date | null {
  const match = dateInputPattern.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return validUtcParts(parsed, year, month, day) ? parsed : null;
}

export function formatDateInputValue(value: Date | null) {
  if (value === null) return "";
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(
    value.getUTCDate(),
  )}`;
}

// Georgia currently observes UTC+04 year-round. datetime-local inputs carry
// wall time without a zone, so conversion must not consult the browser or
// server host timezone.
export function parseGeorgiaDateTimeLocal(value: string): Date | null {
  const match = dateTimeLocalPattern.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const wallTime = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (!validUtcParts(wallTime, year, month, day, hour, minute)) return null;

  return new Date(wallTime.getTime() - GEORGIA_UTC_OFFSET_MILLISECONDS);
}

export function formatGeorgiaDateTimeLocal(value: Date | null) {
  if (value === null) return "";
  const wallTime = new Date(value.getTime() + GEORGIA_UTC_OFFSET_MILLISECONDS);
  return `${wallTime.getUTCFullYear()}-${pad(
    wallTime.getUTCMonth() + 1,
  )}-${pad(wallTime.getUTCDate())}T${pad(wallTime.getUTCHours())}:${pad(
    wallTime.getUTCMinutes(),
  )}`;
}
