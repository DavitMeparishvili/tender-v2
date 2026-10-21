import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getMessages } from "../../localization/get-messages";
import {
  closeOnActivation,
  closeOnEscape,
  closeOnFocusLeave,
  closeOnOutsidePointer,
  createDismissGroup,
  DismissibleDetails,
} from "./dismissible-details";
import { SiteHeader } from "./site-header";

vi.mock("next/navigation", () => ({
  usePathname: () => "/en",
}));

describe("DismissibleDetails", () => {
  it("renders a plain details element so existing menu styles still apply", () => {
    const html = renderToStaticMarkup(
      <DismissibleDetails className="account-menu">
        <summary>Menu</summary>
        <p>Panel</p>
      </DismissibleDetails>,
    );

    expect(html).toBe(
      '<details class="account-menu"><summary>Menu</summary><p>Panel</p></details>',
    );
  });

  it("closes every other open menu in the group when one opens", () => {
    const group = createDismissGroup<{ open: boolean }>();
    const account = { open: true };
    const language = { open: false };
    const help = { open: true };
    group.register(account);
    group.register(language);
    group.register(help);

    language.open = true;
    group.opened(language);

    expect(account.open).toBe(false);
    expect(help.open).toBe(false);
    expect(language.open).toBe(true);
  });

  it("leaves unregistered menus alone", () => {
    const group = createDismissGroup<{ open: boolean }>();
    const account = { open: true };
    const language = { open: true };
    const unregister = group.register(account);
    group.register(language);
    unregister();

    group.opened(language);

    expect(account.open).toBe(true);
  });

  it("keeps the header menus dismissible for signed-in viewers", () => {
    const html = renderToStaticMarkup(
      <SiteHeader
        locale="en"
        messages={getMessages("en")}
        viewer={{ displayName: "Nino Builder", capabilities: ["CUSTOMER"] }}
      />,
    );

    expect(html).toContain('<details class="account-menu">');
    expect(html).toContain('<details class="tender-mobile-locale">');
    expect(html).toContain('<details class="help-menu">');
  });

  describe("closing behavior", () => {
    function menu(open = true, inside: unknown[] = []) {
      const focus = vi.fn();
      return {
        open,
        focus,
        contains: (node: unknown) => inside.includes(node),
        querySelector: () => ({ focus }),
      };
    }
    const target = (matches: string[]) => ({
      closest: (selector: string) =>
        matches.some((m) => selector.includes(m)) ? {} : null,
    });

    it("closes on a pointer press outside, not inside", () => {
      const inner = {};
      const m = menu(true, [inner]);
      closeOnOutsidePointer(m as never, inner as Node);
      expect(m.open).toBe(true);
      closeOnOutsidePointer(m as never, {} as Node);
      expect(m.open).toBe(false);
    });

    it("closes on Escape and only restores focus when it was inside", () => {
      const inner = {};
      const focused = menu(true, [inner]);
      closeOnEscape(focused as never, inner as Element);
      expect(focused.open).toBe(false);
      expect(focused.focus).toHaveBeenCalledOnce();

      const elsewhere = menu(true, [inner]);
      closeOnEscape(elsewhere as never, {} as Element);
      expect(elsewhere.open).toBe(false);
      expect(elsewhere.focus).not.toHaveBeenCalled();
    });

    it("closes when focus moves outside the menu only", () => {
      const inner = {};
      const m = menu(true, [inner]);
      closeOnFocusLeave(m as never, inner as Node);
      closeOnFocusLeave(m as never, null);
      expect(m.open).toBe(true);
      closeOnFocusLeave(m as never, {} as Node);
      expect(m.open).toBe(false);
    });

    it("closes when a link or button inside is activated, but not the summary", () => {
      const summary = menu();
      closeOnActivation(summary as never, target(["summary", "a[href]"]));
      expect(summary.open).toBe(true);

      const link = menu();
      closeOnActivation(link as never, target(["a[href]"]));
      expect(link.open).toBe(false);

      const plain = menu();
      closeOnActivation(plain as never, target([]));
      expect(plain.open).toBe(true);
    });
  });
});
