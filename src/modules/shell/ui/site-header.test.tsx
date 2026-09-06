import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getMessages } from "../../localization/get-messages";
import { SiteHeader } from "./site-header";

const navigation = vi.hoisted(() => ({ pathname: "/en/client/tenders" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

describe("SiteHeader", () => {
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
