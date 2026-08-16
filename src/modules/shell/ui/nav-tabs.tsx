"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isCurrent, type NavItem } from "./nav-model";

export function NavTabs({
  items,
  label,
}: Readonly<{ items: readonly NavItem[]; label: string }>) {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label={label} className="nav-tabs">
      {items.map((item) => (
        <Link
          aria-current={isCurrent(item, pathname) ? "page" : undefined}
          className="nav-tab"
          href={item.href}
          key={item.key}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
