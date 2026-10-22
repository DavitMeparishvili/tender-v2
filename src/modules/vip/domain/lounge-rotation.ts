export const LOUNGE_TIME_ZONE = "Asia/Tbilisi";

const tbilisiDayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: LOUNGE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The calendar date in Asia/Tbilisi as YYYY-MM-DD. */
export function tbilisiDateKey(now: Date): string {
  const parts = tbilisiDayFormat.formatToParts(now);
  const valueOf = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${valueOf("year")}-${valueOf("month")}-${valueOf("day")}`;
}

// FNV-1a, so that the same date string always yields the same 32-bit seed.
function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// mulberry32: a small, dependency-free PRNG with a fixed sequence per seed.
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Orders items for the Lounge: a Fisher-Yates shuffle seeded by the date key.
 * Items are sorted by userId before shuffling, so the result depends only on
 * the set of items and the date, never on the order the caller passed them in.
 * Two calls on the same Tbilisi day return the same order.
 */
export function dailyRotation<T extends Readonly<{ userId: string }>>(
  items: readonly T[],
  dateKey: string,
): T[] {
  const ordered = [...items].sort((left, right) =>
    left.userId < right.userId ? -1 : left.userId > right.userId ? 1 : 0,
  );
  const random = seededRandom(hashSeed(dateKey));
  for (let index = ordered.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    const current = ordered[index];
    ordered[index] = ordered[swapWith] as T;
    ordered[swapWith] = current as T;
  }
  return ordered;
}
