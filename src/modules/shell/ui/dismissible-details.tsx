"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

type Openable = { open: boolean };

/**
 * Header menus share one group: opening one closes the others, so the
 * account and language panels never stack on top of each other.
 */
export function createDismissGroup<T extends Openable>() {
  const members = new Set<T>();

  return {
    register(member: T) {
      members.add(member);
      return () => {
        members.delete(member);
      };
    },
    opened(member: T) {
      for (const other of members) {
        if (other !== member && other.open) other.open = false;
      }
    },
  };
}

const headerMenus = createDismissGroup<HTMLDetailsElement>();

type MenuLike = {
  open: boolean;
  contains(node: Node | null): boolean;
  querySelector<T extends Element>(selector: string): T | null;
};

export function closeOnOutsidePointer(menu: MenuLike, target: Node | null) {
  if (menu.open && !menu.contains(target)) menu.open = false;
}

/** Escape closes the menu; focus only moves back if it was inside the menu. */
export function closeOnEscape(menu: MenuLike, active: Element | null) {
  if (!menu.open) return;
  const hadFocus = menu.contains(active);
  menu.open = false;
  if (hadFocus) menu.querySelector<HTMLElement>(":scope > summary")?.focus();
}

/** Tabbing (or clicking) focus to somewhere outside the menu closes it. */
export function closeOnFocusLeave(menu: MenuLike, next: Node | null) {
  if (menu.open && next !== null && !menu.contains(next)) menu.open = false;
}

/**
 * Following a link or pressing a button inside the panel closes it, even when
 * the link points at the current route (no navigation, so no pathname change).
 */
export function closeOnActivation(
  menu: MenuLike,
  target: Pick<Element, "closest"> | null,
) {
  if (!menu.open || target === null) return;
  if (target.closest("summary") !== null) return;
  if (target.closest("a[href], button") !== null) menu.open = false;
}

/**
 * A native <details> disclosure that behaves like a menu: it closes on a
 * pointer press outside it, on Escape (focus returns to the summary), on
 * navigation, on a link or button press inside it, when focus leaves it, and when another dismissible menu opens. Markup and class
 * names stay those of a plain <details>, so existing styles still apply.
 */
export function DismissibleDetails({
  children,
  className,
}: Readonly<{ children: ReactNode; className?: string }>) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const details = ref.current;
    if (details !== null) details.open = false;
  }, [pathname]);

  useEffect(() => {
    const details = ref.current;
    if (details === null) return;
    const unregister = headerMenus.register(details);

    function handlePointerDown(event: PointerEvent) {
      closeOnOutsidePointer(details!, event.target as Node | null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      closeOnEscape(details!, document.activeElement);
    }

    function handleFocusOut(event: FocusEvent) {
      closeOnFocusLeave(details!, event.relatedTarget as Node | null);
    }

    function handleClick(event: MouseEvent) {
      closeOnActivation(details!, event.target as Element | null);
    }

    function handleToggle() {
      if (details?.open) headerMenus.opened(details);
    }

    details.addEventListener("toggle", handleToggle);
    details.addEventListener("focusout", handleFocusOut);
    details.addEventListener("click", handleClick);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      unregister();
      details.removeEventListener("toggle", handleToggle);
      details.removeEventListener("focusout", handleFocusOut);
      details.removeEventListener("click", handleClick);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <details className={className} ref={ref}>
      {children}
    </details>
  );
}
