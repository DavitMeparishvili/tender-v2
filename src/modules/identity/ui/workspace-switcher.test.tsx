import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../../localization/messages/en.json";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { WorkspaceView } from "./workspace-view";

const labels = {
  switchWorkspace: "Switch workspace",
  openClient: "Open client workspace",
  openProvider: "Open provider workspace",
};

describe("workspace switcher", () => {
  it("does not expose an unavailable provider destination", () => {
    const html = renderToStaticMarkup(
      <WorkspaceSwitcher
        locale="en"
        capabilities={["CUSTOMER"]}
        active="CUSTOMER"
        labels={labels}
      />,
    );

    expect(html).not.toContain("/en/provider");
  });

  it("shows both server-provided destinations to a dual-capability user", () => {
    const html = renderToStaticMarkup(
      <WorkspaceSwitcher
        locale="ka"
        capabilities={["CUSTOMER", "PROVIDER"]}
        active="PROVIDER"
        labels={labels}
      />,
    );

    expect(html).toContain("/ka/client");
    expect(html).toContain("/ka/provider");
    expect(html).toContain('aria-current="page"');
  });

  it("links the provider workspace state to masked tender discovery", () => {
    const html = renderToStaticMarkup(
      <WorkspaceView
        active="PROVIDER"
        locale="en"
        messages={en}
        user={{
          id: "provider-1",
          email: "provider@example.test",
          emailVerified: true,
          displayName: "Provider",
          capabilities: ["PROVIDER"],
          providerSpecialties: ["CONSTRUCTION_REPAIR"],
          preferredLocale: "en",
          preferredCurrency: "GEL",
          onboardingComplete: true,
          disabledAt: null,
          restrictedUntil: null,
        }}
      />,
    );

    expect(html).toContain('href="/en/provider/tenders"');
    expect(html).toContain(en.workspace.providerEmptyBody);
  });
});
