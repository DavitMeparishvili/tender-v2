/**
 * Moves the items that satisfy `isVip` ahead of the rest. Each group keeps the
 * order it arrived in, so the price rank the caller computed survives inside
 * both groups. Display order only: this never changes which offers exist, how
 * they rank, or which one carries the lowest-price flag.
 */
export function orderVipFirst<T>(
  items: readonly T[],
  isVip: (item: T) => boolean,
): readonly T[] {
  return [
    ...items.filter((item) => isVip(item)),
    ...items.filter((item) => !isVip(item)),
  ];
}
