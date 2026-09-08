"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isCurrent, type NavItem } from "./nav-model";

function TabIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: "m3 10 9-8 9 8v12H3V10Z",
    discover: "M5 2h9l5 5v15H5V2Zm9 0v6h5",
    agreements: "M2 8h20v13H2V8Zm6 0V3h8v5M2 13h20m-12-2v5h4v-5",
    profile: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 22v-3a8 8 0 0 1 16 0v3H4Z",
  };
  return (
    <svg
      className="tender-tab-icon"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.profile} />
    </svg>
  );
}

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
              <>
                <TabIcon name={tab.key} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt=""
                  aria-hidden="true"
                  height={19}
                  src={`/icons/${tabIcons[tab.key] ?? "buildings"}.png`}
                  width={19}
                />
              </>
            )}
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
