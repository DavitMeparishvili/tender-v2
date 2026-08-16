import { timingSafeEqual } from "node:crypto";
export function matchesWorkerSecret(
  presented: string | null,
  expected: string,
): boolean {
  if (presented === null) return false;
  const actual = Buffer.from(presented);
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}
