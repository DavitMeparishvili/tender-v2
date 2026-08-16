"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isCurrent, type NavItem } from "./nav-model";

const tabIcons: Readonly<Record<string, string>> = {
  home: "buildings",
  discover: "magnify",
  agreements: "handshake",
  logIn: "profile",
  register: "profile",
  profile: "profile",
};

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
          >
            {isPost ? (
              <span aria-hidden="true">+</span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                aria-hidden="true"
                height={19}
                src={`/icons/${tabIcons[tab.key] ?? "buildings"}.png`}
                width={19}
              />
            )}
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
