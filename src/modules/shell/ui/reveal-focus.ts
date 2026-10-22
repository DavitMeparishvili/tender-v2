/**
 * Clearance, in px, that a focused item needs from each edge of a horizontal
 * scroller: the width of that edge's fade, plus room for the focus ring.
 */
export type RevealClearance = Readonly<{ start: number; end: number }>;

/**
 * A browser scrolls a focused item only when it is fully outside the scroller,
 * so an item cut at an edge keeps its focus ring hidden and sits under the fade.
 * This scrolls the item clear of both edges instead.
 */
export function revealFocusedItem(
  scroller: HTMLElement,
  item: HTMLElement,
  clearance: RevealClearance,
): void {
  const box = scroller.getBoundingClientRect();
  const rect = item.getBoundingClientRect();
  const rightLimit = box.right - clearance.end;
  const leftLimit = box.left + clearance.start;
  if (rect.right > rightLimit) {
    scroller.scrollLeft += rect.right - rightLimit;
  } else if (rect.left < leftLimit) {
    scroller.scrollLeft -= leftLimit - rect.left;
  }
}
