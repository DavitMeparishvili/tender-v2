import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getMessages } from "../../localization/get-messages";
import { SiteHeader } from "./site-header";
import { buildShellNav, isCurrent } from "./nav-model";

const navigation = vi.hoisted(() => ({ pathname: "/en/client/tenders" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

describe("SiteHeader", () => {
  it("makes own offers reachable from contractor mobile navigation", () => {
    const nav = buildShellNav("ka", getMessages("ka"), {
      displayName: "Provider",
      capabilities: ["PROVIDER"],
    });
    const tab = nav.tabs.find((item) => item.key === "myOffers")!;
    expect(tab.href).toBe("/ka/provider/offers");
    expect(isCurrent(tab, "/ka/provider/offers")).toBe(true);
    expect(isCurrent(tab, "/ka/provider/tenders/example")).toBe(false);
  });
  it("keeps mobile Tenders active across client and discovery details", () => {
    const tab = buildShellNav("en", getMessages("en"), {
      displayName: "Client",
      capabilities: ["CUSTOMER"],
    }).tabs.find((item) => item.key === "discover")!;
    expect(tab.href).toBe("/en/client/tenders");
    expect(isCurrent(tab, "/en/client/tenders/owned-id")).toBe(true);
    expect(isCurrent(tab, "/en/provider/tenders/public-id")).toBe(true);
    expect(isCurrent(tab, "/en/client/agreements")).toBe(false);
  });
  it("puts profile and sign-out actions in the global menu for a signed-in viewer", () => {
    navigation.pathname = "/en/profile";
    const messages = getMessages("en");
    const html = renderToStaticMarkup(
      <SiteHeader
        locale="en"
        messages={messages}
        viewer={{ displayName: "Nino Builder", capabilities: ["CUSTOMER"] }}
      />,
    );

    expect(html).toContain('class="account-menu"');
    expect(html).toContain('class="account-menu-identity"');
    expect(html).toContain('href="/en/profile"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain(">Sign out</button>");
    expect(html).toContain("Nino Builder");
    expect(html).toContain(messages.common.verified);
  });

  it("keeps the signed-out header free of account-only actions", () => {
    navigation.pathname = "/en/login";
    const messages = getMessages("en");
    const html = renderToStaticMarkup(
      <SiteHeader locale="en" messages={messages} viewer={null} />,
    );

    expect(html).not.toContain('class="account-menu"');
    expect(html).not.toContain(">Sign out</button>");
    expect(html).toContain('href="/en/login"');
  });
});
