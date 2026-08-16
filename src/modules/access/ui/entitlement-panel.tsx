import type { Messages } from "../../localization/get-messages";
import type { DisclosureLevel } from "../domain/disclosure-policy";
import {
  AccessCheckoutForm,
  type AccessCheckoutCopy,
} from "./access-checkout-form";

export type EntitlementPanelCopy = Readonly<{
  lockedTitle: string;
  lockedBody: string;
  mockNotice: string;
  unlocked: string;
  single: AccessCheckoutCopy;
  monthly: AccessCheckoutCopy;
  annual: AccessCheckoutCopy;
}>;

// Collected in one place, exactly like `publishTenderCopy` in
// `src/modules/tenders/ui/tender-action-copy.ts`, so the client components
// stay free of the whole message catalog.
export function entitlementPanelCopy(messages: Messages): EntitlementPanelCopy {
  const shared = {
    pendingLabel: messages.entitlements.unlocking,
    summaryOne: messages.errors.summaryOne,
    summaryMany: messages.errors.summaryMany,
    genericError: messages.errors.generic,
    alreadyEntitled: messages.entitlements.errors.alreadyEntitled,
    paymentFailed: messages.entitlements.errors.paymentFailed,
    checkoutNotFound: messages.entitlements.errors.checkoutNotFound,
  };
  return {
    lockedTitle: messages.entitlements.lockedTitle,
    lockedBody: messages.entitlements.lockedBody,
    mockNotice: messages.entitlements.mockNotice,
    unlocked: messages.entitlements.unlocked,
    single: { ...shared, label: messages.entitlements.unlockSingle },
    monthly: { ...shared, label: messages.entitlements.unlockMonthly },
    annual: { ...shared, label: messages.entitlements.unlockAnnual },
  };
}

export function EntitlementPanel({
  copy,
  disclosure,
  tenderId,
}: Readonly<{
  copy: EntitlementPanelCopy;
  disclosure: DisclosureLevel;
  tenderId: string;
}>) {
  if (disclosure === "FULL") {
    return (
      <p className="success-status" role="status">
        {copy.unlocked}
      </p>
    );
  }

  return (
    <section
      className="entitlement-panel"
      aria-labelledby="entitlement-heading"
    >
      <h2 id="entitlement-heading">{copy.lockedTitle}</h2>
      <p>{copy.lockedBody}</p>
      <AccessCheckoutForm
        copy={copy.single}
        product="SINGLE_TENDER"
        tenderId={tenderId}
      />
      <AccessCheckoutForm
        copy={copy.monthly}
        product="MONTHLY_PROVIDER"
        tenderId={tenderId}
      />
      <AccessCheckoutForm
        copy={copy.annual}
        product="ANNUAL_PROVIDER"
        tenderId={tenderId}
      />
      {/*
        Truthful about what this release actually does. Hiding the simulation
        would be the one place in this product where the interface claims
        something that is not true.
      */}
      <p className="field-description">{copy.mockNotice}</p>
    </section>
  );
}
