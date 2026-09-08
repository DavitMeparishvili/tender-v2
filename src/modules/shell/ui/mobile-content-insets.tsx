"use client";

import { useEffect } from "react";

/** Reserve the actual height of fixed controls as translations, fonts and zoom
 * change their wrapping. Also discover action bars inserted by streamed routes. */
export function MobileContentInsets() {
  useEffect(() => {
    const root = document.documentElement;
    let bars: Element[] = [];
    const measure = () => {
      for (const [selector, property] of [
        [".tab-bar", "--mobile-nav-height"],
        [".tender-mobile-actions", "--mobile-actions-height"],
      ] as const) {
        const bar = document.querySelector(selector);
        const height = bar?.getBoundingClientRect().height ?? 0;
        root.style.setProperty(property, `${height}px`);
      }
    };
    const resize = new ResizeObserver(measure);
    const discover = () => {
      const next = Array.from(
        document.querySelectorAll(".tab-bar, .tender-mobile-actions"),
      );
      if (
        next.length === bars.length &&
        next.every((bar, i) => bar === bars[i])
      ) {
        return;
      }
      resize.disconnect();
      bars = next;
      bars.forEach((bar) => resize.observe(bar));
      measure();
    };
    const mutations = new MutationObserver(discover);
    mutations.observe(document.body, { childList: true, subtree: true });
    discover();
    return () => {
      resize.disconnect();
      mutations.disconnect();
      root.style.removeProperty("--mobile-nav-height");
      root.style.removeProperty("--mobile-actions-height");
    };
  }, []);

  return null;
}
