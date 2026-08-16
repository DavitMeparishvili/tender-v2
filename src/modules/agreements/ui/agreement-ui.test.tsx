import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AgreementDetail } from "./agreement-detail";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const agreement = {
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
    proposedStartDate: null,
    durationDays: null,
    includedCosts: null,
    exclusions: null,
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
describe("AgreementDetail", () => {
  it("renders immutable terms, status text, and allowed confirmation control", () => {
    const html = renderToStaticMarkup(
      <AgreementDetail agreement={agreement} />,
    );
    expect(html).toContain("Kitchen renovation");
    expect(html).toContain("Fixed scope");
    expect(html).toContain("PENDING_CONFIRMATION");
    expect(html).toContain("Confirm agreement");
  });
});
