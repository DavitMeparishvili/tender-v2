import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getMessages } from "../../localization/get-messages";
import { InboxList } from "./inbox-list";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const messages = getMessages("en");

function renderInbox(
  items: Parameters<typeof InboxList>[0]["items"],
  locale: "en" | "ka" = "en",
) {
  return renderToStaticMarkup(
    <InboxList
      items={items}
      locale={locale}
      messages={getMessages(locale)}
      userId="recipient"
    />,
  );
}

describe("InboxList", () => {
  it("localizes known messages and provides a semantic unread item", () => {
    const html = renderInbox([
      {
        id: "n",
        topic: "AGREEMENT_AGREED",
        aggregateType: "Agreement",
        aggregateId: "a",
        messageKey: "notifications.agreementAgreed",
        variables: { tenderTitle: "Kitchen renovation" },
        readAt: null,
        createdAt: new Date("2026-08-16T10:00:00Z"),
      },
    ]);
    expect(html).toContain(
      "Kitchen renovation: both parties confirmed the agreement.",
    );
    expect(html).toContain('href="/en/agreements/a"');
    expect(html).toContain(messages.notifications.unread);
    expect(html).toContain(messages.notifications.markRead);
    expect(html).toContain('dateTime="2026-08-16T10:00:00.000Z"');
  });

  it("uses localized fallback text and never turns variables into links", () => {
    const html = renderInbox(
      [
        {
          id: "unknown",
          topic: "UNKNOWN",
          aggregateType: "Tender",
          aggregateId: "tender-id",
          messageKey: "notifications.unknown",
          variables: { url: "https://attacker.example/steal" },
          readAt: new Date("2026-08-16T10:01:00Z"),
          createdAt: new Date("2026-08-16T10:00:00Z"),
        },
      ],
      "ka",
    );
    expect(html).toContain(getMessages("ka").notifications.generic);
    expect(html).toContain(getMessages("ka").notifications.read);
    expect(html).not.toContain("https://attacker.example/steal");
    expect(html).not.toContain("<a");
    expect(html).not.toContain("<button");
  });

  it("resolves every persisted notification message key", () => {
    const keys = [
      "notifications.tenderWinnerSelected",
      "notifications.bidWon",
      "notifications.bidLost",
      "notifications.tenderExpiredNoBids",
      "notifications.agreementPartyConfirmed",
      "notifications.agreementAgreed",
      "notifications.agreementDeclined",
      "notifications.agreementExpired",
      "notifications.workStartAcknowledged",
      "notifications.workStarted",
      "notifications.completionConfirmed",
      "notifications.agreementCompleted",
      "notifications.agreementCancelled",
      "notifications.reviewPublished",
      "notifications.reviewRedacted",
    ];
    const html = renderInbox(
      keys.map((messageKey, index) => ({
        id: String(index),
        topic: messageKey,
        aggregateType: "Tender",
        aggregateId: "tender",
        messageKey,
        variables: { tenderTitle: "Kitchen renovation" },
        readAt: new Date("2026-08-16T10:00:00Z"),
        createdAt: new Date("2026-08-16T10:00:00Z"),
      })),
    );
    expect(html).toContain("Kitchen renovation: a winning offer was selected.");
    expect(html).toContain("Kitchen renovation: your offer won.");
    expect(html).toContain("A review was published.");
    expect(html).not.toContain(messages.notifications.generic);
  });
});
