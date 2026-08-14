import type { Locale } from "../../localization/config";
import type { AuthError } from "../application/require-capability";

const errorResponse: Readonly<
  Record<AuthError, Readonly<{ status: number; messageKey: string }>>
> = {
  UNAUTHENTICATED: { status: 401, messageKey: "access.unauthenticated" },
  EMAIL_UNVERIFIED: { status: 403, messageKey: "access.emailUnverified" },
  ONBOARDING_INCOMPLETE: {
    status: 403,
    messageKey: "access.onboardingIncomplete",
  },
  ACCOUNT_DISABLED: { status: 403, messageKey: "access.accountDisabled" },
  ACCOUNT_RESTRICTED: {
    status: 403,
    messageKey: "access.accountRestricted",
  },
  CAPABILITY_MISSING: {
    status: 403,
    messageKey: "access.capabilityMissing",
  },
};

export function mapAccessDenial(error: AuthError, locale: Locale): Response {
  const mapped = errorResponse[error];
  return Response.json(
    { code: error, messageKey: mapped.messageKey },
    {
      status: mapped.status,
      headers: { "content-language": locale },
    },
  );
}
