import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getMessages } from "../../localization/get-messages";
import type { AgreementView } from "../infrastructure/prisma-agreement-gateway";
import { AgreementDetail } from "./agreement-detail";
import { AgreementList } from "./agreement-list";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const messages = getMessages("en");
const baseAgreement: AgreementView = {
  id: "agreement",
  clientId: "client",
  providerId: "provider",
  partyRole: "CLIENT" as const,
  status: "PENDING_CONFIRMATION" as const,
  snapshot: {
    tenderTitle: "Kitchen renovation",
    amountMinorUnits: 1000,
    currency: "GEL" as const,
    conditions: "Fixed scope",
    tenderId: "t",
    clientId: "client",
    providerId: "provider",
    bidId: "b",
    proposedStartDate: "2026-08-20T09:00:00.000Z",
    durationDays: 12,
    includedCosts: "Labour and materials",
    exclusions: "Painting",
  },
  confirmDeadline: new Date("2026-08-18T10:00:00Z"),
  clientConfirmedAt: null,
  providerConfirmedAt: null,
  clientStartedAt: null,
  providerStartedAt: null,
  clientCompletedAt: null,
  providerCompletedAt: null,
  cancelledAt: null,
  cancelledById: null,
  cancellationReasonCode: null,
  cancellationExplanation: null,
  completedAt: null,
  canConfirm: true,
  canDecline: true,
  canAcknowledgeStart: false,
  canConfirmCompletion: false,
  canCancel: false,
  canReview: false,
};

function renderAgreement(overrides: Partial<typeof baseAgreement> = {}) {
  return renderToStaticMarkup(
    <AgreementDetail
      agreement={{ ...baseAgreement, ...overrides }}
      locale="en"
      messages={messages}
    />,
  );
}

describe("AgreementDetail", () => {
  it("renders immutable terms, a semantic date, localized status, and only pending controls", () => {
    const html = renderAgreement();
    expect(html).toContain("Kitchen renovation");
    expect(html).toContain("Fixed scope");
    expect(html).toContain("10\u00a0GEL");
    expect(html).toContain("12 days");
    expect(html).toContain("Labour and materials");
    expect(html).toContain("Painting");
    expect(html).toContain(messages.agreements.statusPendingConfirmation);
    expect(html).toContain('dateTime="2026-08-18T10:00:00.000Z"');
    expect(html).toContain(messages.agreements.confirm);
    expect(html).toContain(messages.agreements.decline);
    expect(html).not.toContain(messages.agreements.acknowledgeStart);
    expect(html).not.toContain(messages.agreements.confirmCompletion);
  });

  it("renders exact controls for every lifecycle state", () => {
    const agreed = renderAgreement({
      status: "AGREED",
      canConfirm: false,
      canDecline: false,
      canAcknowledgeStart: true,
      canCancel: true,
    });
    expect(agreed).toContain(messages.agreements.acknowledgeStart);
    expect(agreed).toContain(messages.agreements.cancel);
    expect(agreed).not.toContain(messages.agreements.confirm);

    const inProgress = renderAgreement({
      status: "IN_PROGRESS",
      canConfirm: false,
      canDecline: false,
      canConfirmCompletion: true,
      canCancel: true,
    });
    expect(inProgress).toContain(messages.agreements.confirmCompletion);
    expect(inProgress).toContain(messages.agreements.cancel);
    expect(inProgress).not.toContain(messages.agreements.acknowledgeStart);

    for (const status of ["COMPLETED", "CANCELLED"] as const) {
      const terminal = renderAgreement({
        status,
        canConfirm: false,
        canDecline: false,
        canAcknowledgeStart: false,
        canConfirmCompletion: false,
        canCancel: false,
      });
      expect(terminal).not.toContain("<button");
    }
  });

  it("puts the decline and cancellation consequences before the irreversible control", () => {
    const declined = renderAgreement();
    expect(
      declined.indexOf(messages.agreements.declineConsequence),
    ).toBeLessThan(declined.indexOf(messages.agreements.decline));
    const cancelled = renderAgreement({
      status: "AGREED",
      canConfirm: false,
      canDecline: false,
      canAcknowledgeStart: false,
      canCancel: true,
    });
    expect(
      cancelled.indexOf(messages.agreements.cancelConsequence),
    ).toBeLessThan(cancelled.indexOf(messages.agreements.cancel));
  });

  it("replaces the review form with an already-reviewed state", () => {
    const html = renderToStaticMarkup(
      <AgreementDetail
        agreement={{
          ...baseAgreement,
          status: "COMPLETED",
          canConfirm: false,
          canDecline: false,
          canReview: true,
        }}
        hasPublishedReview
        locale="en"
        messages={messages}
      />,
    );
    expect(html).toContain(messages.reviews.alreadyReviewed);
    expect(html).not.toContain(messages.reviews.publish);
  });
});

describe("AgreementList", () => {
  it("groups participant agreements and uses locale-safe links", () => {
    const completed = {
      ...baseAgreement,
      id: "completed",
      status: "COMPLETED" as const,
      canConfirm: false,
      canDecline: false,
    };
    const waitingForOtherParty = {
      ...baseAgreement,
      id: "waiting",
      status: "AGREED" as const,
      canConfirm: false,
      canDecline: false,
      canCancel: true,
    };
    const html = renderToStaticMarkup(
      <AgreementList
        agreements={[baseAgreement, waitingForOtherParty, completed]}
        locale="ka"
        messages={getMessages("ka")}
      />,
    );
    expect(html).toContain(getMessages("ka").agreements.needsAction);
    expect(html).toContain(getMessages("ka").agreements.currentWork);
    expect(html).toContain(getMessages("ka").agreements.completedOrCancelled);
    expect(html).toContain('href="/ka/agreements/agreement"');
    expect(html).toContain('href="/ka/agreements/completed"');
  });
});
