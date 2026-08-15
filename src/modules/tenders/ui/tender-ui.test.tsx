import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../../localization/messages/en.json";
import type { TenderDraft } from "../domain/tender";
import { TenderDetailContent } from "./tender-detail";
import { formatTenderDate, formatTenderMoney } from "./tender-format";
import { TenderListContent } from "./tender-list";
import { cancelTenderRequest } from "./tender-mutation-request";
import { tenderToWizardForm } from "./tender-wizard-initial";

const tender: TenderDraft = {
  id: "tender-1",
  ownerId: "owner-1",
  status: "PUBLISHED",
  specialty: "CONSTRUCTION_REPAIR",
  title: "Repaint two bedrooms",
  shortDescription: "Prepare and repaint two bedrooms.",
  fullDescription:
    "Protect the floors, prepare the walls, and apply two coats.",
  scopeOfWork: "Two bedrooms with minor wall repairs.",
  budgetMinorUnits: 123_456,
  currency: "GEL",
  desiredStartDate: new Date("2026-09-02T08:00:00.000Z"),
  deadline: new Date("2026-08-31T12:00:00.000Z"),
  workerNotes: "Two painters preferred.",
  equipmentNotes: "Bring ladders.",
  materialNotes: "Low-VOC paint required.",
  location: {
    countryCode: "GE",
    city: "Tbilisi",
    district: "Vake",
    addressLine: "1 Chavchavadze Ave",
    exact: { latitude: 41.71, longitude: 44.75 },
    public: { latitude: 41.7, longitude: 44.8 },
  },
  conditions: "Work during daytime hours.",
  publishedAt: new Date("2026-08-15T12:00:00.000Z"),
  cancelledAt: null,
  cancelReason: null,
  createdAt: new Date("2026-08-14T12:00:00.000Z"),
  updatedAt: new Date("2026-08-15T12:00:00.000Z"),
};

describe("client tender UI", () => {
  it("formats integer minor units and dates for the selected locale", () => {
    expect(formatTenderMoney(123_456, "GEL", "en")).toContain("1,234.56");
    expect(formatTenderMoney(123_456, "GEL", "ka")).toContain("1234,56");
    expect(formatTenderMoney(null, "GEL", "en")).toBeNull();
    expect(formatTenderDate(tender.deadline, "en")).toContain("Aug");
    expect(formatTenderDate(tender.deadline, "ka")).not.toContain("Aug");
  });

  it("renders an owned-tender list as linked semantic rows", () => {
    const html = renderToStaticMarkup(
      <TenderListContent locale="en" messages={en} tenders={[tender]} />,
    );

    expect(html).toContain("<ul");
    expect(html).toContain('href="/en/client/tenders/tender-1"');
    expect(html).toContain(en.tenders.statusPublished);
    expect(html).toContain("GEL");
    expect(html).toContain("1,234.56");
    expect(html).toContain(en.tenders.deadline);
    expect(html).toContain(en.tenders.cancel);
  });

  it("gives drafts real resume, publish, and cancellation entry points", () => {
    const draft: TenderDraft = { ...tender, status: "DRAFT" };
    const html = renderToStaticMarkup(
      <TenderListContent locale="en" messages={en} tenders={[draft]} />,
    );

    expect(html).toContain('href="/en/client/tenders/new?tenderId=tender-1"');
    expect(html).toContain(
      'href="/en/client/tenders/tender-1#publish-heading"',
    );
    expect(html).toContain('href="/en/client/tenders/tender-1#cancel-heading"');
  });

  it("keeps cancelled tender rows read-only", () => {
    const html = renderToStaticMarkup(
      <TenderListContent
        locale="en"
        messages={en}
        tenders={[{ ...tender, status: "CANCELLED" }]}
      />,
    );

    expect(html).toContain(en.tenders.viewDetail);
    expect(html).not.toContain("?tenderId=");
    expect(html).not.toContain("#publish-heading");
    expect(html).not.toContain("#cancel-heading");
  });

  it("renders the truthful empty state without sample records", () => {
    const html = renderToStaticMarkup(
      <TenderListContent locale="en" messages={en} tenders={[]} />,
    );

    expect(html).toContain(en.tenders.clientListEmpty);
    expect(html).not.toContain("<ul");
    expect(html).not.toContain(tender.title);
  });

  it("renders owner-visible detail and withholds cancellation after cancellation", () => {
    const cancelled: TenderDraft = {
      ...tender,
      status: "CANCELLED",
      cancelledAt: new Date("2026-08-16T12:00:00.000Z"),
      cancelReason: "The project scope changed.",
    };
    const html = renderToStaticMarkup(
      <TenderDetailContent
        cancelControl={<button type="button">cancel control</button>}
        locale="en"
        messages={en}
        tender={cancelled}
      />,
    );

    expect(html).toContain(en.tenders.statusCancelled);
    expect(html).toContain(cancelled.fullDescription ?? "");
    expect(html).toContain(cancelled.scopeOfWork ?? "");
    expect(html).toContain(cancelled.location?.addressLine ?? "");
    expect(html).toContain(cancelled.cancelReason ?? "");
    expect(html).not.toContain("cancel control");
  });

  it("renders cancellation only for an active tender", () => {
    const html = renderToStaticMarkup(
      <TenderDetailContent
        cancelControl={<button type="button">cancel control</button>}
        locale="en"
        messages={en}
        tender={tender}
      />,
    );

    expect(html).toContain("cancel control");
    expect(html).toContain('aria-labelledby="cancel-heading"');
  });

  it("renders publish before cancel for a draft", () => {
    const html = renderToStaticMarkup(
      <TenderDetailContent
        publishControl={<button type="button">publish control</button>}
        cancelControl={<button type="button">cancel control</button>}
        locale="en"
        messages={en}
        tender={{ ...tender, status: "DRAFT" }}
      />,
    );

    expect(html).toContain('aria-labelledby="publish-heading"');
    expect(html.indexOf("publish control")).toBeLessThan(
      html.indexOf("cancel control"),
    );
  });

  it("hydrates an owned draft into the wizard without money or timezone drift", () => {
    const form = tenderToWizardForm(tender, ["scope.pdf"]);

    expect(form.budget).toBe("1234.56");
    expect(form.deadline).toBe("2026-08-31T16:00");
    expect(form.locationMode).toBe("PIN");
    expect(form.latitude).toBe("41.71");
    expect(form.attachmentNames).toEqual(["scope.pdf"]);
  });

  it("posts the cancellation command using the application contract", () => {
    const request = cancelTenderRequest("The project scope changed.");

    expect(request.method).toBe("POST");
    expect(request.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(String(request.body))).toEqual({
      reason: "The project scope changed.",
    });
  });
});
