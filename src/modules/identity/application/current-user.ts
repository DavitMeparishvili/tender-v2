import { database } from "../../../infrastructure/db/client";
import type { Capability, ProviderSpecialty } from "../domain/capability";
import { auth } from "../infrastructure/auth";

export type CurrentUser = Readonly<{
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  capabilities: readonly Capability[];
  providerSpecialties: readonly ProviderSpecialty[];
  preferredLocale: "ka" | "en";
  preferredCurrency: "GEL" | "USD";
  onboardingComplete: boolean;
  disabledAt: Date | null;
  restrictedUntil: Date | null;
}>;

const capabilityOrder: Readonly<Record<Capability, number>> = {
  CUSTOMER: 0,
  PROVIDER: 1,
  ADMIN: 2,
};

function normalizeLocale(value: string | undefined): "ka" | "en" {
  return value === "en" ? "en" : "ka";
}

function normalizeCurrency(value: string | undefined): "GEL" | "USD" {
  return value === "USD" ? "USD" : "GEL";
}

export async function getCurrentUser(
  headers: Headers,
): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers });
  if (session === null) {
    return null;
  }

  const user = await database.user.findUnique({
    where: { id: session.user.id },
    include: {
      capabilities: { select: { code: true } },
      profile: true,
      providerProfile: { select: { specialties: true } },
    },
  });
  if (user === null) {
    return null;
  }

  const capabilities = user.capabilities
    .map(({ code }) => code satisfies Capability)
    .sort((left, right) => capabilityOrder[left] - capabilityOrder[right]);
  const providerSpecialties = (user.providerProfile?.specialties ?? []).filter(
    (specialty): specialty is ProviderSpecialty =>
      specialty === "CONSTRUCTION_REPAIR",
  );

  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: user.profile?.displayName ?? user.name,
    capabilities,
    providerSpecialties,
    preferredLocale: normalizeLocale(user.profile?.preferredLocale),
    preferredCurrency: normalizeCurrency(user.profile?.preferredCurrency),
    onboardingComplete:
      user.profile?.onboardingCompleteAt !== null && user.profile !== null,
    disabledAt: user.profile?.disabledAt ?? null,
    restrictedUntil: user.profile?.restrictedUntil ?? null,
  };
}
