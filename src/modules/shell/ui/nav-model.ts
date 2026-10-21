import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";

/**
 * The shell needs to know who is looking without importing another module's
 * domain, so it accepts the shape it actually reads.
 */
export type ShellCapability = "CUSTOMER" | "PROVIDER" | "ADMIN";

export type ShellViewer = Readonly<{
  displayName: string;
  capabilities: readonly ShellCapability[];
}>;

export type NavItem = Readonly<{
  key: string;
  href: string;
  label: string;
  /** Sub-routes that should also light this tab up. */
  match?: readonly string[];
}>;

export type ShellAction = Readonly<{ href: string; label: string }>;

export type ShellNav = Readonly<{
  items: readonly NavItem[];
  primary: ShellAction | null;
  secondary: ShellAction | null;
  tabs: readonly NavItem[];
}>;

function has(viewer: ShellViewer | null, capability: ShellCapability): boolean {
  return viewer?.capabilities.includes(capability) ?? false;
}

/**
 * One place decides what the header, the mobile tab bar and the footer link
 * to, so a page can never end up unreachable from the shell. Destinations are
 * only offered when the viewer's capabilities allow them; a route the server
 * would deny is not shown as navigation.
 */
export function buildShellNav(
  locale: Locale,
  messages: Messages,
  viewer: ShellViewer | null,
): ShellNav {
  const at = (path: string) => `/${locale}${path}`;
  const isClient = has(viewer, "CUSTOMER");
  const isProvider = has(viewer, "PROVIDER");
  const isAdmin = has(viewer, "ADMIN");

  const items: NavItem[] = [
    {
      key: "discover",
      href: at("/provider/tenders"),
      label: messages.nav.discover,
    },
  ];

  if (isClient) {
    items.push({
      key: "myTenders",
      href: at("/client/tenders"),
      label: messages.nav.myTenders,
      match: [at("/client")],
    });
  }

  if (isProvider) {
    items.push({
      key: "myOffers",
      href: at("/provider/offers"),
      label: messages.nav.myOffers,
    });
  }

  if (viewer !== null) {
    items.push({
      key: "agreements",
      href: at(isClient ? "/client/agreements" : "/provider/agreements"),
      label: messages.nav.agreements,
    });
    items.push({
      key: "inbox",
      href: at("/notifications"),
      label: messages.nav.inbox,
    });
  }

  if (isAdmin) {
    items.push({
      key: "moderation",
      href: at("/admin/reviews"),
      label: messages.nav.moderation,
    });
  }

  if (viewer === null) {
    items.push({
      key: "howItWorks",
      href: at("/#how-it-works"),
      label: messages.nav.howItWorks,
    });
  }

  // Publishing a tender needs the client capability. A provider who does not
  // have it gets no emerald call to action rather than one that duplicates a nav
  // tab or leads to a workspace the server would deny.
  const primary: ShellAction | null =
    viewer === null
      ? { href: at("/register/client"), label: messages.nav.postTender }
      : isClient
        ? { href: at("/client/tenders/new"), label: messages.nav.postTender }
        : null;

  const secondary: ShellAction | null =
    viewer === null
      ? { href: at("/login"), label: messages.nav.logIn }
      : { href: at("/profile"), label: viewer.displayName };

  // The bar is decided by role alone, never by the current page, so every
  // screen shows the same five tabs and only the active one changes. A viewer
  // who can publish (signed out or client, i.e. `primary` exists) gets the
  // centre "+"; a contractor-only viewer gets their offers in that slot
  // instead. A viewer holding both capabilities follows the client layout, as
  // the header's call to action and the contracts link already do.
  const roleTab: NavItem =
    primary === null
      ? {
          key: "myOffers",
          href: at("/provider/offers"),
          label: messages.nav.mobileOffers,
        }
      : { key: "post", href: primary.href, label: messages.nav.mobilePost };

  const tabs: NavItem[] = [
    { key: "home", href: at(""), label: messages.nav.home },
    {
      key: "discover",
      href: at(isClient ? "/client/tenders" : "/provider/tenders"),
      label: messages.nav.mobileDiscover,
      match: [at("/provider/tenders")],
    },
    roleTab,
    viewer === null
      ? { key: "logIn", href: at("/login"), label: messages.nav.logIn }
      : {
          key: "agreements",
          href: at(isClient ? "/client/agreements" : "/provider/agreements"),
          label: messages.nav.mobileAgreements,
        },
    viewer === null
      ? {
          key: "register",
          href: at("/register"),
          label: messages.nav.mobileRegister,
        }
      : { key: "profile", href: at("/profile"), label: messages.nav.profile },
  ];

  return { items, primary, secondary, tabs };
}

/**
 * A tab owns a route when the path is the destination itself or sits beneath
 * it. `/ka` would otherwise claim every page, so the home tab matches exactly.
 */
export function isCurrent(item: NavItem, pathname: string): boolean {
  const candidates = [item.href, ...(item.match ?? [])].map(
    (href) => href.split("#")[0] ?? href,
  );

  return candidates.some((href) => {
    const normalized = href.replace(/\/$/, "");
    const isLocaleRoot = /^\/[^/]+$/.test(normalized);
    return isLocaleRoot
      ? pathname === normalized
      : pathname === normalized || pathname.startsWith(`${normalized}/`);
  });
}
