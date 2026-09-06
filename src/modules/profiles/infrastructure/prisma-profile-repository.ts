import { Prisma } from "../../../generated/prisma/client";
import { database } from "../../../infrastructure/db/client";
import { isLocale } from "../../localization/config";
import type { Result } from "../../shared";
import type {
  CompleteOnboardingCommand,
  OnboardingActor,
  OnboardingError,
  OnboardingIds,
  OnboardingRepository,
  SafeProfileView,
} from "../application/complete-onboarding";
import type { ProviderDisplayNameRepository } from "../application/get-provider-display-names";
import type {
  PublicProfileRepository,
  PublicProfileView,
} from "../application/get-public-profile";
import type {
  OwnProfileRepository,
  ProfileActor,
  ProfileUpdateError,
  UpdateOwnProfileCommand,
} from "../application/update-own-profile";

type PersistedProfile = Prisma.UserProfileGetPayload<{
  include: {
    user: {
      include: {
        capabilities: { select: { code: true } };
        providerProfile: { select: { specialties: true } };
      };
    };
  };
}>;

function toSafeProfile(profile: PersistedProfile): SafeProfileView {
  const capabilities = profile.user.capabilities.map(({ code }) => code).sort();
  const providerSpecialties = (
    profile.user.providerProfile?.specialties ?? []
  ).filter((specialty) => specialty === "CONSTRUCTION_REPAIR");

  return {
    userId: profile.userId,
    accountKind: profile.accountKind === "COMPANY" ? "COMPANY" : "PERSON",
    displayName: profile.displayName,
    phoneE164: profile.phoneE164,
    countryCode: "GE",
    city: profile.city,
    activityDescription: profile.activityDescription,
    preferredLocale: isLocale(profile.preferredLocale)
      ? profile.preferredLocale
      : "ka",
    preferredCurrency: profile.preferredCurrency === "USD" ? "USD" : "GEL",
    profilePhotoObjectKey: profile.profilePhotoObjectKey,
    onboardingComplete: profile.onboardingCompleteAt !== null,
    capabilities,
    providerSpecialties,
  };
}

function isPhoneConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

const profileInclude = {
  user: {
    include: {
      capabilities: { select: { code: true } },
      providerProfile: { select: { specialties: true } },
    },
  },
} as const;

export class PrismaProfileRepository
  implements
    OnboardingRepository,
    OwnProfileRepository,
    ProviderDisplayNameRepository,
    PublicProfileRepository
{
  async getOwn(
    actor: ProfileActor,
  ): Promise<Result<SafeProfileView, "PROFILE_NOT_FOUND">> {
    const profile = await database.userProfile.findUnique({
      where: { userId: actor.id },
      include: profileInclude,
    });
    return profile === null
      ? { ok: false, error: "PROFILE_NOT_FOUND" }
      : { ok: true, value: toSafeProfile(profile) };
  }

  async complete(
    command: CompleteOnboardingCommand,
    actor: OnboardingActor,
    ids: OnboardingIds,
    now: Date,
  ): Promise<
    Result<SafeProfileView, Exclude<OnboardingError, "INVALID_INPUT">>
  > {
    try {
      return await database.$transaction(async (transaction) => {
        await transaction.$queryRaw(
          Prisma.sql`SELECT "id" FROM "user" WHERE "id" = ${actor.id} FOR UPDATE`,
        );
        const user = await transaction.user.findUnique({
          where: { id: actor.id },
          select: { id: true, emailVerified: true },
        });
        if (user === null) {
          return { ok: false, error: "USER_NOT_FOUND" } as const;
        }
        if (!user.emailVerified || !actor.emailVerified) {
          return { ok: false, error: "EMAIL_UNVERIFIED" } as const;
        }

        const existing = await transaction.userProfile.findUnique({
          where: { userId: actor.id },
          include: profileInclude,
        });
        if (existing?.onboardingCompleteAt !== null && existing !== null) {
          return { ok: true, value: toSafeProfile(existing) } as const;
        }

        const profile = await transaction.userProfile.upsert({
          where: { userId: actor.id },
          create: {
            id: ids.profileId,
            userId: actor.id,
            accountKind: command.accountKind,
            displayName: command.displayName,
            phoneE164: command.phoneE164,
            countryCode: command.countryCode,
            city: command.city,
            activityDescription: command.activityDescription,
            preferredLocale: command.preferredLocale,
            preferredCurrency: command.preferredCurrency,
            onboardingCompleteAt: now,
          },
          update: {
            accountKind: command.accountKind,
            displayName: command.displayName,
            phoneE164: command.phoneE164,
            countryCode: command.countryCode,
            city: command.city,
            activityDescription: command.activityDescription,
            preferredLocale: command.preferredLocale,
            preferredCurrency: command.preferredCurrency,
            onboardingCompleteAt: now,
          },
        });
        const capability =
          command.intent === "CLIENT" ? "CUSTOMER" : "PROVIDER";
        await transaction.userCapability.upsert({
          where: { userId_code: { userId: actor.id, code: capability } },
          create: {
            id: ids.capabilityId,
            userId: actor.id,
            code: capability,
          },
          update: {},
        });
        if (command.intent === "CONSTRUCTION_PROVIDER") {
          await transaction.providerProfile.upsert({
            where: { userId: actor.id },
            create: {
              id: ids.providerProfileId,
              userId: actor.id,
              specialties: ["CONSTRUCTION_REPAIR"],
            },
            update: { specialties: { push: "CONSTRUCTION_REPAIR" } },
          });
        }
        await transaction.auditEvent.create({
          data: {
            id: ids.auditEventId,
            actorId: actor.id,
            action: "PROFILE_ONBOARDING_COMPLETED",
            targetType: "UserProfile",
            targetId: profile.id,
            correlationId: ids.auditEventId,
            metadata: { intent: command.intent },
          },
        });

        const completed = await transaction.userProfile.findUniqueOrThrow({
          where: { userId: actor.id },
          include: profileInclude,
        });
        return { ok: true, value: toSafeProfile(completed) } as const;
      });
    } catch (error) {
      if (isPhoneConflict(error)) {
        return { ok: false, error: "PHONE_CONFLICT" };
      }
      throw error;
    }
  }

  async updateOwn(
    command: UpdateOwnProfileCommand,
    actor: ProfileActor,
  ): Promise<
    Result<SafeProfileView, Exclude<ProfileUpdateError, "INVALID_INPUT">>
  > {
    try {
      const profile = await database.userProfile.update({
        where: { userId: actor.id },
        data: {
          ...(command.displayName === undefined
            ? {}
            : { displayName: command.displayName }),
          ...(command.phoneE164 === undefined
            ? {}
            : { phoneE164: command.phoneE164, phoneVerifiedAt: null }),
          ...(command.city === undefined ? {} : { city: command.city }),
          ...(command.activityDescription === undefined
            ? {}
            : { activityDescription: command.activityDescription }),
          ...(command.preferredLocale === undefined
            ? {}
            : { preferredLocale: command.preferredLocale }),
          ...(command.preferredCurrency === undefined
            ? {}
            : { preferredCurrency: command.preferredCurrency }),
          ...(command.profilePhotoObjectKey === undefined
            ? {}
            : { profilePhotoObjectKey: command.profilePhotoObjectKey }),
        },
        include: profileInclude,
      });
      return { ok: true, value: toSafeProfile(profile) };
    } catch (error) {
      if (isPhoneConflict(error)) {
        return { ok: false, error: "PHONE_CONFLICT" };
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return { ok: false, error: "PROFILE_NOT_FOUND" };
      }
      throw error;
    }
  }

  async findDisplayNames(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    const rows = await database.userProfile.findMany({
      where: { userId: { in: [...userIds] } },
      // Only the public display name leaves this module. Selecting the whole
      // profile here would put phone numbers one careless spread away from a
      // competitor-visible response.
      select: { userId: true, displayName: true },
    });
    return new Map(rows.map((row) => [row.userId, row.displayName]));
  }

  async getPublic(userId: string) {
    const profile = await database.userProfile.findUnique({
      where: { userId },
      select: {
        userId: true,
        displayName: true,
        accountKind: true,
        city: true,
        activityDescription: true,
        user: {
          select: {
            providerProfile: { select: { specialties: true } },
          },
        },
      },
    });
    if (profile === null)
      return { ok: false as const, error: "PROFILE_NOT_FOUND" as const };
    const value: PublicProfileView = {
      userId: profile.userId,
      displayName: profile.displayName,
      accountKind: profile.accountKind === "COMPANY" ? "COMPANY" : "PERSON",
      city: profile.city,
      activityDescription: profile.activityDescription,
      providerSpecialties: (
        profile.user.providerProfile?.specialties ?? []
      ).filter(
        (specialty): specialty is "CONSTRUCTION_REPAIR" =>
          specialty === "CONSTRUCTION_REPAIR",
      ),
    };
    return { ok: true as const, value };
  }
}

export const prismaProfileRepository = new PrismaProfileRepository();
