import Link from "next/link";
import type { Messages } from "../../localization/get-messages";
import { BrandIcon } from "../../shell/ui/brand-icon";
import type { DisclosureLevel } from "../domain/disclosure-policy";
import {
  AccessCheckoutForm,
  type AccessCheckoutCopy,
} from "./access-checkout-form";

export type EntitlementPanelCopy = Readonly<{
  lockedTitle: string;
  lockedBody: string;
  orEverything: string;
  mockNotice: string;
  unlocked: string;
  signInTitle: string;
  signInBody: string;
  signInCta: string;
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
    orEverything: messages.entitlements.orEverything,
    mockNotice: messages.entitlements.mockNotice,
    unlocked: messages.entitlements.unlocked,
    signInTitle: messages.entitlements.signInTitle,
    signInBody: messages.entitlements.signInBody,
    signInCta: messages.entitlements.signInCta,
    single: { ...shared, label: messages.entitlements.unlockSingle },
    monthly: {
      ...shared,
      label: messages.entitlements.monthlyName,
      note: messages.entitlements.monthlyNote,
      price: messages.entitlements.monthlyPrice,
    },
    annual: {
      ...shared,
      label: messages.entitlements.annualName,
      note: messages.entitlements.annualNote,
      price: messages.entitlements.annualPrice,
    },
  };
}

/**
 * The gate is the decision this page exists to support, so it gets the only
 * emerald-bordered surface in the system. What it does NOT do is hide anything:
 * the masked projection is produced on the server, and this card only offers
 * the purchase that changes it.
 */
export function EntitlementPanel({
  canPurchase,
  copy,
  disclosure,
  loginHref,
  tenderId,
}: Readonly<{
  /** False for an anonymous visitor or a signed-in non-provider: they can
   *  read the locked-card copy but must sign in as a provider before any
   *  checkout attempt, which the backend would reject anyway. */
  canPurchase: boolean;
  copy: EntitlementPanelCopy;
  disclosure: DisclosureLevel;
  loginHref: string;
  tenderId: string;
}>) {
  if (disclosure === "FULL") {
    return (
      <p className="success-status" role="status">
        {copy.unlocked}
      </p>
    );
  }

  if (!canPurchase) {
    return (
      <section aria-labelledby="entitlement-heading" className="unlock-card">
        <h2 className="unlock-head" id="entitlement-heading">
          <BrandIcon name="secure" opacity={0.7} size={18} />
          {copy.signInTitle}
        </h2>
        <div className="unlock-body">
          <p>{copy.signInBody}</p>
          <Link className="pill pill-brand unlock-primary" href={loginHref}>
            {copy.signInCta}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="entitlement-heading" className="unlock-card">
      <h2 className="unlock-head" id="entitlement-heading">
        <BrandIcon name="secure" opacity={0.7} size={18} />
        {copy.lockedTitle}
      </h2>
      <div className="unlock-body">
        <p>{copy.lockedBody}</p>
        <AccessCheckoutForm
          copy={copy.single}
          product="SINGLE_TENDER"
          tenderId={tenderId}
        />
        <p className="unlock-divider">{copy.orEverything}</p>
        <div className="unlock-options">
          <AccessCheckoutForm
            copy={copy.monthly}
            product="MONTHLY_PROVIDER"
            tenderId={tenderId}
            variant="option"
          />
          <AccessCheckoutForm
            copy={copy.annual}
            product="ANNUAL_PROVIDER"
            tenderId={tenderId}
            variant="option"
          />
        </div>
        {/*
          Truthful about what this release actually does. Hiding the simulation
          would be the one place in this product where the interface claims
          something that is not true.
        */}
        <p className="unlock-foot">{copy.mockNotice}</p>
      </div>
    </section>
  );
}
