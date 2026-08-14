import { z } from "zod";
import type { Clock, IdGenerator, Result } from "../../shared";
import type {
  Capability,
  ProviderSpecialty,
} from "../../identity/domain/capability";

const normalizedPhoneSchema = z
  .string()
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/));

export const completeOnboardingCommandSchema = z
  .object({
    intent: z.enum(["CLIENT", "CONSTRUCTION_PROVIDER"]),
    accountKind: z.enum(["PERSON", "COMPANY"]),
    displayName: z.string().trim().min(2).max(120),
    phoneE164: normalizedPhoneSchema,
    countryCode: z.literal("GE"),
    city: z.string().trim().min(2).max(120),
    activityDescription: z.string().trim().min(2).max(2_000),
    preferredLocale: z.enum(["ka", "en"]),
    preferredCurrency: z.enum(["GEL", "USD"]),
  })
  .strict();

export type CompleteOnboardingCommand = z.output<
  typeof completeOnboardingCommandSchema
>;

export type OnboardingActor = Readonly<{
  id: string;
  emailVerified: boolean;
}>;

export type SafeProfileView = Readonly<{
  userId: string;
  accountKind: "PERSON" | "COMPANY";
  displayName: string;
  phoneE164: string;
  countryCode: "GE";
  city: string;
  activityDescription: string;
  preferredLocale: "ka" | "en";
  preferredCurrency: "GEL" | "USD";
  profilePhotoObjectKey: string | null;
  onboardingComplete: boolean;
  capabilities: readonly Capability[];
  providerSpecialties: readonly ProviderSpecialty[];
}>;

export type OnboardingError =
  "INVALID_INPUT" | "USER_NOT_FOUND" | "EMAIL_UNVERIFIED" | "PHONE_CONFLICT";

export type OnboardingIds = Readonly<{
  profileId: string;
  capabilityId: string;
  providerProfileId: string;
  auditEventId: string;
}>;

export interface OnboardingRepository {
  complete(
    command: CompleteOnboardingCommand,
    actor: OnboardingActor,
    ids: OnboardingIds,
    now: Date,
  ): Promise<
    Result<SafeProfileView, Exclude<OnboardingError, "INVALID_INPUT">>
  >;
}

type CompleteOnboardingDependencies = Readonly<{
  repository: OnboardingRepository;
  ids: IdGenerator;
  clock: Clock;
}>;

export function createCompleteOnboarding({
  repository,
  ids,
  clock,
}: CompleteOnboardingDependencies) {
  return async function completeOnboarding(
    input: unknown,
    actor: OnboardingActor,
  ): Promise<Result<SafeProfileView, OnboardingError>> {
    const parsed = completeOnboardingCommandSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "INVALID_INPUT" };
    }

    return repository.complete(
      parsed.data,
      actor,
      {
        profileId: ids.next(),
        capabilityId: ids.next(),
        providerProfileId: ids.next(),
        auditEventId: ids.next(),
      },
      clock.now(),
    );
  };
}

const systemIds: IdGenerator = { next: () => crypto.randomUUID() };
const systemClock: Clock = { now: () => new Date() };

export async function completeOnboarding(
  input: unknown,
  actor: OnboardingActor,
): Promise<Result<SafeProfileView, OnboardingError>> {
  const { prismaProfileRepository } =
    await import("../infrastructure/prisma-profile-repository");
  return createCompleteOnboarding({
    repository: prismaProfileRepository,
    ids: systemIds,
    clock: systemClock,
  })(input, actor);
}
