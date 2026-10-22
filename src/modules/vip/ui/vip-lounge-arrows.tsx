"use client";

import { useEffect, useState } from "react";
import { revealFocusedItem } from "../../shell/ui/reveal-focus";

// Each arrow click moves the scroller by this share of its visible width.
const STEP_SHARE = 0.8;
// Sub-pixel rounding can leave a few pixels short of the true end.
const EDGE_TOLERANCE_PX = 2;
// The partly shown chip is sized so this share of it is visible at the edge.
const CUT_CHIP_SHARE = 0.4;
const CHIP_GAP_PX = 8;
const MIN_CHIP_PX = 180;
const MAX_CHIP_DESKTOP_PX = 280;
const MAX_CHIP_MOBILE_PX = 260;
// Fade widths (28px on phones, 36px on desktop) plus the 4px focus ring.
const FOCUS_CLEARANCE = { start: 32, end: 40 };

/**
 * The chip width that shows `k` whole chips and `CUT_CHIP_SHARE` of the next
 * one across `available` px. Uses the largest `k` that keeps chips at least
 * MIN_CHIP_PX wide, so a narrow row still has a cut-off chip to scroll to.
 */
export function chipWidthFor(available: number, maxChipPx: number): number {
  for (let whole = 8; whole >= 1; whole -= 1) {
    const width = (available - whole * CHIP_GAP_PX) / (whole + CUT_CHIP_SHARE);
    if (width >= MIN_CHIP_PX) {
      return Math.min(maxChipPx, width);
    }
  }
  return MIN_CHIP_PX;
}

/**
 * Controls the VIP Lounge scroller: sizes the chips so a partly shown chip
 * cues the scroll, marks which edges have content beyond them for the fades,
 * scrolls a focused chip clear of those fades, and renders the previous and
 * next buttons when the strip has enough partners. The chips themselves are
 * server-rendered links; this component never scrolls on its own.
 */
export function VipLoungeArrows({
  scrollerId,
  showArrows,
  previousLabel,
  nextLabel,
}: Readonly<{
  scrollerId: string;
  showArrows: boolean;
  previousLabel: string;
  nextLabel: string;
}>) {
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    const scroller = document.getElementById(scrollerId);
    if (!(scroller instanceof HTMLElement)) return;

    // The chips start after the scroller's left padding, so the cut-off chip
    // is measured against the room to the right of that padding.
    const fitChips = () => {
      const paddingLeft = parseFloat(getComputedStyle(scroller).paddingLeft);
      const available = scroller.clientWidth - (paddingLeft || 0);
      const maxChip = window.matchMedia("(width > 1023px)").matches
        ? MAX_CHIP_DESKTOP_PX
        : MAX_CHIP_MOBILE_PX;
      scroller.style.setProperty(
        "--vip-chip-w",
        `${chipWidthFor(available, maxChip)}px`,
      );
    };

    const update = () => {
      const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
      const started = scroller.scrollLeft <= EDGE_TOLERANCE_PX;
      const ended = scroller.scrollLeft >= maxScrollLeft - EDGE_TOLERANCE_PX;
      setAtStart(started);
      setAtEnd(ended);
      scroller.dataset.fadeStart = String(!started);
      scroller.dataset.fadeEnd = String(
        maxScrollLeft > EDGE_TOLERANCE_PX && !ended,
      );
    };

    const onResize = () => {
      fitChips();
      update();
    };

    const onFocus = (event: FocusEvent) => {
      const focused = event.target;
      if (!(focused instanceof HTMLElement) || !scroller.contains(focused)) {
        return;
      }
      revealFocusedItem(scroller, focused, FOCUS_CLEARANCE);
      update();
    };

    fitChips();
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    scroller.addEventListener("focusin", onFocus);
    window.addEventListener("resize", onResize);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(onResize);
    observer?.observe(scroller);

    return () => {
      scroller.removeEventListener("scroll", update);
      scroller.removeEventListener("focusin", onFocus);
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
      delete scroller.dataset.fadeStart;
      delete scroller.dataset.fadeEnd;
      scroller.style.removeProperty("--vip-chip-w");
    };
  }, [scrollerId]);

  function scrollBy(direction: -1 | 1) {
    const scroller = document.getElementById(scrollerId);
    if (!(scroller instanceof HTMLElement)) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    scroller.scrollBy({
      left: direction * scroller.clientWidth * STEP_SHARE,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  if (!showArrows) return null;

  return (
    <div className="vip-lounge-arrows">
      <button
        aria-controls={scrollerId}
        aria-label={previousLabel}
        className="vip-lounge-arrow"
        disabled={atStart}
        onClick={() => scrollBy(-1)}
        type="button"
      >
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16">
          <path
            d="M10 3 L5 8 L10 13"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      </button>
      <button
        aria-controls={scrollerId}
        aria-label={nextLabel}
        className="vip-lounge-arrow"
        disabled={atEnd}
        onClick={() => scrollBy(1)}
        type="button"
      >
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16">
          <path
            d="M6 3 L11 8 L6 13"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      </button>
    </div>
  );
}
