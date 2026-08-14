import { z } from "zod";
import type { Result } from "../../shared";
import type { SafeProfileView } from "./complete-onboarding";

const normalizedPhoneSchema = z
  .string()
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/));

export const updateOwnProfileCommandSchema = z
  .object({
    displayName: z.string().trim().min(2).max(120).optional(),
    phoneE164: normalizedPhoneSchema.optional(),
    city: z.string().trim().min(2).max(120).optional(),
    activityDescription: z.string().trim().min(2).max(2_000).optional(),
    preferredLocale: z.enum(["ka", "en"]).optional(),
    preferredCurrency: z.enum(["GEL", "USD"]).optional(),
    profilePhotoObjectKey: z
      .string()
      .trim()
      .min(1)
      .max(512)
      .nullable()
      .optional(),
  })
  .strict()
  .refine((command) => Object.keys(command).length > 0);

export type UpdateOwnProfileCommand = z.output<
  typeof updateOwnProfileCommandSchema
>;
export type ProfileActor = Readonly<{ id: string }>;
export type ProfileUpdateError =
  "INVALID_INPUT" | "PROFILE_NOT_FOUND" | "PHONE_CONFLICT";

export interface OwnProfileRepository {
  getOwn(
    actor: ProfileActor,
  ): Promise<Result<SafeProfileView, "PROFILE_NOT_FOUND">>;
  updateOwn(
    command: UpdateOwnProfileCommand,
    actor: ProfileActor,
  ): Promise<
    Result<SafeProfileView, Exclude<ProfileUpdateError, "INVALID_INPUT">>
  >;
}

export function createGetOwnProfile(repository: OwnProfileRepository) {
  return function getOwnProfile(
    actor: ProfileActor,
  ): Promise<Result<SafeProfileView, "PROFILE_NOT_FOUND">> {
    return repository.getOwn(actor);
  };
}

export function createUpdateOwnProfile(repository: OwnProfileRepository) {
  return async function updateOwnProfile(
    input: unknown,
    actor: ProfileActor,
  ): Promise<Result<SafeProfileView, ProfileUpdateError>> {
    const parsed = updateOwnProfileCommandSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "INVALID_INPUT" };
    }
    return repository.updateOwn(parsed.data, actor);
  };
}

export async function updateOwnProfile(
  input: unknown,
  actor: ProfileActor,
): Promise<Result<SafeProfileView, ProfileUpdateError>> {
  const { prismaProfileRepository } =
    await import("../infrastructure/prisma-profile-repository");
  return createUpdateOwnProfile(prismaProfileRepository)(input, actor);
}

export async function getOwnProfile(
  actor: ProfileActor,
): Promise<Result<SafeProfileView, "PROFILE_NOT_FOUND">> {
  const { prismaProfileRepository } =
    await import("../infrastructure/prisma-profile-repository");
  return createGetOwnProfile(prismaProfileRepository)(actor);
}
