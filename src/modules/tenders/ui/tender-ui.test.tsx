import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../../localization/messages/en.json";
import ka from "../../localization/messages/ka.json";
import type { TenderDraft } from "../domain/tender";
import { resolveCustomerRouteAccess } from "./customer-route-access";
import {
  TenderDetailContent,
  type TenderAttachmentView,
} from "./tender-detail";
import {
  formatAttachmentSize,
  formatTenderDate,
  formatTenderMoney,
} from "./tender-format";
import { TenderListContent } from "./tender-list";
import {
  cancelTenderRequest,
  publishTenderRequest,
} from "./tender-mutation-request";
import { tenderToWizardForm } from "./tender-wizard-initial";
import { tenderPageCopy } from "./tender-page-copy";

const tender: TenderDraft = {
  id: "tender-1",
  ownerId: "owner-1",
  status: "PUBLISHED",
  specialty: "CONSTRUCTION_REPAIR",
  serviceCode: "GENERAL_CONSTRUCTION",
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
    mode: "ADDRESS",
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

const attachments: readonly TenderAttachmentView[] = [
  {
    id: "attachment-1",
    originalFileName: "site-photo.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 9_551_713,
    url: "https://storage.test/site-photo",
  },
  {
    id: "attachment-2",
    originalFileName: "scope.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
    url: "https://storage.test/scope",
  },
];

const sizeUnits = {
  bytes: en.tenders.attachmentSizeBytes,
  kilobytes: en.tenders.attachmentSizeKilobytes,
  megabytes: en.tenders.attachmentSizeMegabytes,
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

  it("gives drafts resume and detail actions with cancellation behind management", () => {
    const draft: TenderDraft = { ...tender, status: "DRAFT" };
    const html = renderToStaticMarkup(
      <TenderListContent locale="en" messages={en} tenders={[draft]} />,
    );

    expect(html).toContain('href="/en/client/tenders/new?tenderId=tender-1"');
    expect(html).toContain('href="/en/client/tenders/tender-1"');
    expect(html).toContain('href="/en/client/tenders/tender-1#management"');
    expect(html).toContain('<details class="tender-overflow"');
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

    expect(html).toContain(tenderPageCopy("en").noMatches);
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
        publishControl={<button type="button">publish control</button>}
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
    expect(html).not.toContain("publish control");
  });

  it("renders cancellation only for an active tender", () => {
    const html = renderToStaticMarkup(
      <TenderDetailContent
        publishControl={<button type="button">publish control</button>}
        cancelControl={<button type="button">cancel control</button>}
        locale="en"
        messages={en}
        tender={tender}
      />,
    );

    expect(html).toContain("cancel control");
    expect(html).not.toContain("publish control");
    expect(html).toContain(
      '<details class="tender-cancel-disclosure" id="cancel-heading">',
    );
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

    expect(html).toContain('id="publish-heading"');
    expect(html.indexOf("publish control")).toBeLessThan(
      html.indexOf("cancel control"),
    );
  });

  it("formats attachment sizes with the same 1024-based units as the upload cap", () => {
    expect(formatAttachmentSize(160, "en", sizeUnits)).toBe("160 B");
    expect(formatAttachmentSize(2048, "en", sizeUnits)).toBe("2 KB");
    expect(formatAttachmentSize(9_551_713, "en", sizeUnits)).toBe("9.1 MB");
    expect(formatAttachmentSize(15 * 1024 * 1024, "en", sizeUnits)).toBe(
      "15 MB",
    );
  });

  it("formats attachment sizes with the Georgian decimal separator", () => {
    const kaUnits = {
      bytes: ka.tenders.attachmentSizeBytes,
      kilobytes: ka.tenders.attachmentSizeKilobytes,
      megabytes: ka.tenders.attachmentSizeMegabytes,
    };

    expect(formatAttachmentSize(9_551_713, "ka", kaUnits)).toContain("9,1");
  });

  it("shows owner attachments as thumbnails for images and named links for documents", () => {
    const html = renderToStaticMarkup(
      <TenderDetailContent
        locale="en"
        messages={en}
        tender={tender}
        attachments={attachments}
      />,
    );

    expect(html).toContain('id="attachments"');
    expect(html).toContain(en.tenders.attachments);
    expect(html).toContain('aria-label="Preview site-photo.jpg"');
    expect(html).toContain('src="https://storage.test/site-photo"');
    expect(html).toContain("site-photo.jpg");
    expect(html).toContain('href="https://storage.test/scope"');
    expect(html).toContain("scope.pdf");
    expect(html).toContain("2 KB");
  });

  it("keeps a document attachment out of the image thumbnails", () => {
    const html = renderToStaticMarkup(
      <TenderDetailContent
        locale="en"
        messages={en}
        tender={tender}
        attachments={[attachments[1] as TenderAttachmentView]}
      />,
    );

    expect(html).toContain("scope.pdf");
    expect(html).not.toContain("<img");
  });

  it("keeps the attachment section reachable and states that there are no files", () => {
    const html = renderToStaticMarkup(
      <TenderDetailContent
        locale="en"
        messages={en}
        tender={tender}
        attachments={[]}
      />,
    );

    expect(html).toContain('id="attachments"');
    expect(html).toContain(tenderPageCopy("en").noAttachments);
  });

  it("hydrates an owned draft into the wizard without money or timezone drift", () => {
    const form = tenderToWizardForm(tender, ["scope.pdf"]);

    expect(form.budget).toBe("1234.56");
    expect(form.deadline).toBe("2026-08-31T16:00");
    expect(form.desiredStartDate).toBe("2026-09-02");
    // The draft was located by address, so it must resume in ADDRESS mode:
    // resuming in PIN mode would make step 3 submit a pin command, and
    // `syncTenderLocation` would overwrite the client's exact street address
    // with the reverse geocoder's "Near <city>, Georgia".
    expect(form.locationMode).toBe("ADDRESS");
    expect(form.addressLine).toBe("1 Chavchavadze Ave");
    expect(form.latitude).toBe("41.71");
    expect(form.attachmentNames).toEqual(["scope.pdf"]);
  });

  it("resumes a pin-located draft in PIN mode with its pin intact", () => {
    const form = tenderToWizardForm({
      ...tender,
      location: {
        countryCode: "GE",
        mode: "PIN",
        city: "Tbilisi",
        district: null,
        addressLine: "Near Tbilisi, Georgia",
        exact: { latitude: 41.733_3, longitude: 44.791_2 },
        public: { latitude: 41.73, longitude: 44.79 },
      },
    });

    expect(form.locationMode).toBe("PIN");
    expect(form.latitude).toBe("41.7333");
    expect(form.longitude).toBe("44.7912");
  });

  it("hydrates nullable draft fields and the attachment maximum exactly", () => {
    const attachmentNames = Array.from(
      { length: 10 },
      (_, index) => `scope-${index + 1}.pdf`,
    );
    const form = tenderToWizardForm(
      {
        ...tender,
        shortDescription: null,
        fullDescription: null,
        scopeOfWork: null,
        budgetMinorUnits: null,
        currency: null,
        desiredStartDate: null,
        deadline: null,
        workerNotes: null,
        equipmentNotes: null,
        materialNotes: null,
        location: null,
        conditions: null,
      },
      attachmentNames,
    );

    expect(form).toMatchObject({
      shortDescription: "",
      fullDescription: "",
      scopeOfWork: "",
      budget: "",
      desiredStartDate: "",
      deadline: "",
      workerNotes: "",
      equipmentNotes: "",
      materialNotes: "",
      conditions: "",
      locationMode: "ADDRESS",
      city: "",
      district: "",
      addressLine: "",
      latitude: "",
      longitude: "",
    });
    expect(form.attachmentNames).toEqual(attachmentNames);
    expect(form.attachmentNames).toHaveLength(10);
  });

  it("posts the cancellation command using the application contract", () => {
    const request = cancelTenderRequest("The project scope changed.");

    expect(request.method).toBe("POST");
    expect(request.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(String(request.body))).toEqual({
      reason: "The project scope changed.",
    });
  });

  it("keeps the publish request bodyless", () => {
    expect(publishTenderRequest).toEqual({ method: "POST" });
    expect(publishTenderRequest.body).toBeUndefined();
  });

  it("resolves the reused customer route guard outcomes", () => {
    const actor = {
      id: "owner-1",
      email: "owner@tender.test",
      emailVerified: true,
      displayName: "Owner",
      capabilities: ["CUSTOMER" as const],
      providerSpecialties: [],
      preferredLocale: "en" as const,
      preferredCurrency: "GEL" as const,
      onboardingComplete: true,
      disabledAt: null,
      restrictedUntil: null,
    };

    expect(resolveCustomerRouteAccess({ ok: true, value: actor })).toEqual({
      kind: "GRANTED",
      actor,
    });
    expect(
      resolveCustomerRouteAccess({
        ok: false,
        error: "UNAUTHENTICATED",
      }),
    ).toEqual({ kind: "LOGIN" });
    for (const error of [
      "EMAIL_UNVERIFIED",
      "ONBOARDING_INCOMPLETE",
      "ACCOUNT_DISABLED",
      "ACCOUNT_RESTRICTED",
      "CAPABILITY_MISSING",
    ] as const) {
      expect(resolveCustomerRouteAccess({ ok: false, error })).toEqual({
        kind: "DENIED",
        error,
      });
    }
  });
});
