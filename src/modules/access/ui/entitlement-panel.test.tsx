import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import en from "../../localization/messages/en.json";
import type { Messages } from "../../localization/get-messages";
import { EntitlementPanel, entitlementPanelCopy } from "./entitlement-panel";

// `AccessCheckoutForm` calls `useRouter()` for its post-confirm refresh, which
// throws outside an actual app-router tree. `renderToStaticMarkup` renders no
// tree at all, so the hook is stubbed the same way client-only navigation is
// stubbed elsewhere in this suite.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

const messages = en as Messages;

describe("EntitlementPanel", () => {
  it("makes temporary free access clear without advertising paid prices", () => {
    const markup = renderToStaticMarkup(
      <EntitlementPanel
        canPurchase
        copy={entitlementPanelCopy(messages)}
        disclosure="MASKED"
        loginHref="/en/login"
        tenderId="tender-1"
      />,
    );

    expect(markup).toContain("Full access is free for now");
    expect(markup).toContain("Unlock for free");
    expect(markup.match(/Free for now/g)).toHaveLength(2);
    expect(markup).not.toContain("USD");
  });

  it("explains that one click opens access without payment details", () => {
    const markup = renderToStaticMarkup(
      <EntitlementPanel
        canPurchase
        copy={entitlementPanelCopy(messages)}
        disclosure="MASKED"
        loginHref="/en/login"
        tenderId="tender-1"
      />,
    );

    expect(markup).toContain(messages.entitlements.mockNotice);
  });

  it("renders no purchase control once the provider is entitled", () => {
    const markup = renderToStaticMarkup(
      <EntitlementPanel
        canPurchase
        copy={entitlementPanelCopy(messages)}
        disclosure="FULL"
        loginHref="/en/login"
        tenderId="tender-1"
      />,
    );

    expect(markup).not.toContain(messages.entitlements.unlockSingle);
    expect(markup).toContain(messages.entitlements.unlocked);
  });

  it("prompts sign-in instead of a purchase control for a non-provider viewer", () => {
    const markup = renderToStaticMarkup(
      <EntitlementPanel
        canPurchase={false}
        copy={entitlementPanelCopy(messages)}
        disclosure="MASKED"
        loginHref="/en/login"
        tenderId="tender-1"
      />,
    );

    expect(markup).not.toContain(messages.entitlements.unlockSingle);
    expect(markup).toContain(messages.entitlements.signInTitle);
    expect(markup).toContain('href="/en/login"');
  });
});
