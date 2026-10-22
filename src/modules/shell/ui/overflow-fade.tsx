"use client";

import { useEffect } from "react";
import { revealFocusedItem } from "./reveal-focus";

// Sub-pixel rounding can leave a few pixels short of the true end.
const EDGE_TOLERANCE_PX = 2;
// The desktop fade is 36px wide; a focused pill also needs its 4px focus ring.
const FOCUS_CLEARANCE = { start: 4, end: 40 };

/**
 * Marks a horizontally scrolling element with data-fade="true" while content
 * lies beyond its right edge, so CSS can fade that edge. The fade is removed
 * when the element is scrolled to the end or when nothing overflows. It
 * re-measures on scroll and resize, and when the element or its children
 * change size (for example when a web font loads). A focused child is scrolled
 * clear of the fade.
 */
export function OverflowFade({ targetId }: Readonly<{ targetId: string }>) {
  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!(target instanceof HTMLElement)) return;

    const update = () => {
      const maxScrollLeft = target.scrollWidth - target.clientWidth;
      const atEnd = target.scrollLeft >= maxScrollLeft - EDGE_TOLERANCE_PX;
      target.dataset.fade = String(maxScrollLeft > EDGE_TOLERANCE_PX && !atEnd);
    };

    const revealFocused = (event: FocusEvent) => {
      const focused = event.target;
      if (!(focused instanceof HTMLElement) || !target.contains(focused))
        return;
      revealFocusedItem(target, focused, FOCUS_CLEARANCE);
      update();
    };

    update();
    target.addEventListener("scroll", update, { passive: true });
    target.addEventListener("focusin", revealFocused);
    window.addEventListener("resize", update);

    // Late font loading changes the pill widths without resizing the row, so
    // the row and each of its children are observed.
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(target);
    for (const child of Array.from(target.children)) {
      observer?.observe(child);
    }

    return () => {
      target.removeEventListener("scroll", update);
      target.removeEventListener("focusin", revealFocused);
      window.removeEventListener("resize", update);
      observer?.disconnect();
      delete target.dataset.fade;
    };
  }, [targetId]);

  return null;
}
