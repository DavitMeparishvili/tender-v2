import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../../localization/messages/en.json";
import type { Messages } from "../../localization/get-messages";
import type { ClientBidView } from "../application/list-tender-bids";
import { BidComparison, bidComparisonCopy } from "./bid-comparison";

const messages = en as Messages;

const bids: ClientBidView[] = [
  {
    id: "bid-cheap",
    providerDisplayName: "Alpha Builders",
    amountMinorUnits: 40_000,
    currency: "GEL",
    status: "SUBMITTED",
    proposedStartDate: null,
    durationDays: 14,
    includedCosts: "Paint and labour",
    exclusions: "Scaffolding",
    conditions: "Weekday work only, materials included in the quoted price.",
    qualifyingSubmittedAt: "2026-06-10T09:00:00.000Z",
  },
  {
    id: "bid-expensive",
    providerDisplayName: "Beta Repairs",
    amountMinorUnits: 90_000,
    currency: "GEL",
    status: "SUBMITTED",
    proposedStartDate: null,
    durationDays: null,
    includedCosts: null,
    exclusions: null,
    conditions: "Full service including all materials and site cleanup.",
    qualifyingSubmittedAt: "2026-06-11T09:00:00.000Z",
  },
];

describe("BidComparison", () => {
  it("lists offers in the ranked order the selector will use", () => {
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

  it("states that the winner is chosen automatically", () => {
    const markup = renderToStaticMarkup(
      <BidComparison
        bids={bids}
        copy={bidComparisonCopy(messages)}
        locale="en"
      />,
    );

    expect(markup).toContain(messages.bidding.automaticWinner);
  });

  it("offers the client no control that selects a provider", () => {
    const markup = renderToStaticMarkup(
      <BidComparison
        bids={bids}
        copy={bidComparisonCopy(messages)}
        locale="en"
      />,
    );

    // The single most important assertion on this surface: there is no
    // button, no form, and no link through which a client could choose.
    expect(markup).not.toContain("<button");
    expect(markup).not.toContain("<form");
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
});
