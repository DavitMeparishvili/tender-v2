"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isCurrent, type NavItem } from "./nav-model";

/**
 * One stroked icon set for every tab on every page; `currentColor` lets the
 * active state recolour it together with the label.
 */
const tabIconPaths: Readonly<Record<string, string>> = {
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3V10.5Z",
  discover: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.05-4.05",
  myOffers: "M5 2h9l5 5v15H5V2Zm9 0v6h5M8 12h8m-8 4h5",
  agreements: "M2 8h20v13H2V8Zm6 0V3h8v5M2 13h20m-12-2v5h4v-5",
  profile: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 22v-3a8 8 0 0 1 16 0v3H4Z",
  logIn: "M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5M10 17l5-5-5-5m5 5H3",
  register:
    "M15 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM3 21v-2a8 8 0 0 1 11.5-7.2M19 14v6m-3-3h6",
};

function TabIcon({ name }: { name: string }) {
  return (
    <svg
      className="tab-icon"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={tabIconPaths[name] ?? tabIconPaths.profile} />
    </svg>
  );
}

/**
 * The bottom bar only exists at phone widths (see `.tab-bar` in globals.css);
 * on wider viewports the header nav carries the same destinations, so this
 * renders no duplicate landmark for a desktop screen reader user.
 */
export function MobileTabBar({
  tabs,
  label,
}: Readonly<{ tabs: readonly NavItem[]; label: string }>) {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label={label} className="tab-bar">
      {tabs.map((tab) => {
        const isPost = tab.key === "post";
        return (
          <Link
            aria-current={
              !isPost && isCurrent(tab, pathname) ? "page" : undefined
            }
            className={isPost ? "tab-item tab-post" : "tab-item"}
            href={tab.href}
            key={tab.key}
            title={tab.label}
          >
            {isPost ? (
              <span aria-hidden="true">+</span>
            ) : (
              <TabIcon name={tab.key} />
            )}
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
