import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import en from "../../localization/messages/en.json";
import type { Messages } from "../../localization/get-messages";
import type { ClientBidView } from "../application/list-tender-bids";
import { BidComparison, bidComparisonCopy } from "./bid-comparison";

const messages = en as Messages;

const bids: ClientBidView[] = [
  {
    id: "bid-cheap",
    providerId: "provider-alpha",
    providerDisplayName: "Alpha Builders",
    providerIsVip: false,
    amountMinorUnits: 40_000,
    currency: "GEL",
    status: "SUBMITTED",
    proposedStartDate: null,
    durationDays: 14,
    includedCosts: "Paint and labour",
    exclusions: "Scaffolding",
    conditions: "Weekday work only, materials included in the quoted price.",
    qualifyingSubmittedAt: "2026-06-10T09:00:00.000Z",
    choosable: true,
    lowestPrice: true,
  },
  {
    id: "bid-expensive",
    providerId: "provider-beta",
    providerDisplayName: "Beta Repairs",
    providerIsVip: false,
    amountMinorUnits: 90_000,
    currency: "GEL",
    status: "SUBMITTED",
    proposedStartDate: null,
    durationDays: null,
    includedCosts: null,
    exclusions: null,
    conditions: "Full service including all materials and site cleanup.",
    qualifyingSubmittedAt: "2026-06-11T09:00:00.000Z",
    choosable: true,
    lowestPrice: false,
  },
];

describe("BidComparison", () => {
  it("lists offers from the lowest price", () => {
    const markup = renderToStaticMarkup(
      <BidComparison
        bids={bids}
        copy={bidComparisonCopy(messages)}
        locale="en"
      />,
    );

    expect(markup.indexOf("Alpha Builders")).toBeLessThan(
      markup.indexOf("Beta Repairs"),
    );
  });

  it("states that the client chooses the contractor", () => {
    const markup = renderToStaticMarkup(
      <BidComparison
        bids={bids}
        copy={bidComparisonCopy(messages)}
        locale="en"
      />,
    );

    expect(markup).toContain(messages.bidding.selectionRuleOwner);
  });

  it("offers no choose control unless selection is open", () => {
    const markup = renderToStaticMarkup(
      <BidComparison
        bids={bids}
        copy={bidComparisonCopy(messages)}
        locale="en"
        selection={{ tenderId: "tender", open: false, chooseBy: null }}
      />,
    );

    expect(markup).not.toContain(messages.bidding.choose.action);
    expect(markup).not.toContain(messages.bidding.lowestPrice);
  });

  it("lets the client choose any choosable offer while selection is open", () => {
    const markup = renderToStaticMarkup(
      <BidComparison
        bids={[
          ...bids,
          {
            ...bids[1]!,
            id: "bid-withdrawn",
            providerDisplayName: "Gamma Works",
            status: "WITHDRAWN",
            choosable: false,
          },
        ]}
        copy={bidComparisonCopy(messages)}
        locale="en"
        selection={{
          tenderId: "tender",
          open: true,
          chooseBy: "4 Nov 2026, 13:00",
        }}
      />,
    );

    // One control per choosable offer — the cheaper AND the dearer one — and
    // none on the withdrawn offer.
    expect(markup.split(`>${messages.bidding.choose.action}<`).length - 1).toBe(
      2,
    );
    // Lowest price is labelled, as information only.
    expect(markup.split(messages.bidding.lowestPrice).length - 1).toBe(1);
    expect(markup).toContain(
      messages.bidding.chooseBy.replace("{date}", "4 Nov 2026, 13:00"),
    );
  });

  it("links each provider's name to their public profile", () => {
    const markup = renderToStaticMarkup(
      <BidComparison
        bids={bids}
        copy={bidComparisonCopy(messages)}
        locale="en"
      />,
    );

    expect(markup).toContain('href="/en/profiles/provider-alpha"');
    expect(markup).toContain('href="/en/profiles/provider-beta"');
  });

  it("renders a truthful empty state rather than sample offers", () => {
    const markup = renderToStaticMarkup(
      <BidComparison
        bids={[]}
        copy={bidComparisonCopy(messages)}
        locale="en"
      />,
    );

    expect(markup).toContain(messages.bidding.comparisonEmpty);
    expect(markup).not.toContain("Alpha Builders");
  });

  it("communicates status with text, not colour alone", () => {
    const markup = renderToStaticMarkup(
      <BidComparison
        bids={[{ ...bids[0]!, status: "WINNER" }]}
        copy={bidComparisonCopy(messages)}
        locale="en"
      />,
    );

    expect(markup).toContain(messages.bidding.statusWinner);
  });

  it("badges only the offers from VIP providers", () => {
    const markup = renderToStaticMarkup(
      <BidComparison
        bids={[{ ...bids[0]!, providerIsVip: true }, bids[1]!]}
        copy={bidComparisonCopy(messages)}
        locale="en"
      />,
    );

    expect(markup).toContain(`aria-label="${messages.vip.badgeLabel}"`);
    expect(markup.split(messages.vip.badgeLabel)).toHaveLength(2);
  });

  it("shows the VIP disclosure when an offer is from a VIP provider", () => {
    const markup = renderToStaticMarkup(
      <BidComparison
        bids={[{ ...bids[0]!, providerIsVip: true }, bids[1]!]}
        copy={bidComparisonCopy(messages)}
        locale="en"
      />,
    );

    // The apostrophe in the copy is HTML-escaped in the markup, so match the
    // first sentence, which has none.
    expect(markup).toContain("Price ranking and the client");
    expect(markup).toContain("never change.");
  });

  it("does not repeat the VIP-first sentence that the intro already states", () => {
    const markup = renderToStaticMarkup(
      <BidComparison
        bids={[{ ...bids[0]!, providerIsVip: true }, bids[1]!]}
        copy={bidComparisonCopy(messages)}
        locale="en"
      />,
    );

    // The intro (on by default) carries the VIP-first sentence once; the
    // disclosure carries only the neutrality sentence, once.
    expect(markup.split("VIP partners are listed first")).toHaveLength(2);
    expect(markup.split("never change.")).toHaveLength(2);
  });

  it("omits the VIP disclosure when no offer is from a VIP provider", () => {
    const markup = renderToStaticMarkup(
      <BidComparison
        bids={bids}
        copy={bidComparisonCopy(messages)}
        locale="en"
      />,
    );

    expect(markup).not.toContain("never change.");
  });

  it("states the VIP-first order in the intro, not a price-only order", () => {
    expect(messages.bidding.selectionRuleOwner).toContain(
      "VIP partners are listed first",
    );
  });
});
