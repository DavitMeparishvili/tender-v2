import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkspaceSwitcher } from "./workspace-switcher";

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
});
