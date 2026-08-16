import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InboxList } from "./inbox-list";
describe("InboxList", () => {
  it("renders an unread notification with machine-readable time", () => {
    const html = renderToStaticMarkup(
      <InboxList
        items={[
          {
            id: "n",
            topic: "AGREEMENT_AGREED",
            aggregateType: "Agreement",
            aggregateId: "a",
            messageKey: "notifications.agreementAgreed",
            variables: {},
            readAt: null,
            createdAt: new Date("2026-08-16T10:00:00Z"),
          },
        ]}
      />,
    );
    expect(html).toContain("notifications.agreementAgreed");
    expect(html).toContain("dateTime=");
    expect(html).toContain("Unread");
  });
});
