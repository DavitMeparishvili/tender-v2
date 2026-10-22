"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PointerEvent, RefObject } from "react";

const SHEET_QUERY = "(max-width: 640px)";
export const EXIT_MS = 200;
// Released past a quarter of the sheet, or flicked faster than this (px/ms).
const DISMISS_SHARE = 0.25;
const FLICK_SPEED = 0.6;

function subscribeToSheetQuery(onChange: () => void) {
  const query = window.matchMedia(SHEET_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True on phone widths, where the chat is a bottom sheet instead of a dock. */
export function useIsSheetLayout() {
  return useSyncExternalStore(
    subscribeToSheetQuery,
    () => window.matchMedia(SHEET_QUERY).matches,
    () => false,
  );
}

function moveSheet(sheet: HTMLElement, transform: string, transition: string) {
  sheet.style.transition = transition;
  sheet.style.transform = transform;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Phone bottom-sheet behaviour while `active`: page scroll lock,
 * keyboard-aware sizing, drag-to-dismiss and a slide-down exit. For the
 * desktop dock `dismiss` only flags `closing` for the CSS exit animation.
 */
export function useBottomSheet({
  active,
  panel,
  onDismissed,
}: Readonly<{
  active: boolean;
  panel: RefObject<HTMLElement | null>;
  onDismissed: () => void;
}>) {
  const [closing, setClosing] = useState(false);
  const drag = useRef<{
    startY: number;
    startTime: number;
    offset: number;
    dragging: boolean;
  } | null>(null);

  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);

  // Keep the composer above the on-screen keyboard: the visual viewport
  // shrinks while it is open, the layout viewport (and `bottom: 0`) does not.
  useEffect(() => {
    const viewport = window.visualViewport;
    const sheet = panel.current;
    if (!active || !viewport || !sheet) return;
    const update = () => {
      const keyboard =
        window.innerHeight - viewport.height - viewport.offsetTop;
      sheet.style.setProperty("--sheet-keyboard", `${Math.max(0, keyboard)}px`);
      sheet.style.setProperty("--sheet-viewport", `${viewport.height}px`);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [active, panel]);

  const dismiss = () => {
    const sheet = panel.current;
    if (!sheet || prefersReducedMotion()) {
      onDismissed();
      return;
    }
    if (closing) return;
    setClosing(true);
    if (active) {
      moveSheet(sheet, "translateY(100%)", `transform ${EXIT_MS}ms ease-in`);
    }
    window.setTimeout(() => {
      setClosing(false);
      onDismissed();
    }, EXIT_MS);
  };

  const snapBack = () => {
    const sheet = panel.current;
    if (!sheet) return;
    moveSheet(sheet, "", "transform 200ms ease-out");
  };

  const dragHandlers = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (!active || closing || event.button !== 0) return;
      drag.current = {
        startY: event.clientY,
        startTime: event.timeStamp,
        offset: 0,
        dragging: false,
      };
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const state = drag.current;
      const sheet = panel.current;
      if (!state || !sheet) return;
      const offset = Math.max(0, event.clientY - state.startY);
      // Capture only once it is clearly a drag, so taps still reach the
      // close button inside the header.
      if (!state.dragging) {
        if (offset < 6) return;
        state.dragging = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      state.offset = offset;
      moveSheet(sheet, `translateY(${offset}px)`, "none");
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const state = drag.current;
      const sheet = panel.current;
      drag.current = null;
      if (!state?.dragging || !sheet) return;
      const speed =
        state.offset / Math.max(1, event.timeStamp - state.startTime);
      if (
        state.offset > sheet.offsetHeight * DISMISS_SHARE ||
        speed > FLICK_SPEED
      ) {
        dismiss();
      } else {
        snapBack();
      }
    },
    onPointerCancel: () => {
      if (drag.current?.dragging) snapBack();
      drag.current = null;
    },
  };

  return { closing, dismiss, dragHandlers };
}
