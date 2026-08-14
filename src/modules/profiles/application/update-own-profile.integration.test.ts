import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { completeOnboarding } from "./complete-onboarding";
import {
  updateOwnProfile,
  updateOwnProfileCommandSchema,
} from "./update-own-profile";

const ownerId = "profile-owner";
const otherId = "profile-other";

async function resetFixtures() {
  await database.auditEvent.deleteMany({
    where: { actorId: { in: [ownerId, otherId] } },
  });
  await database.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
}

async function createOnboardedUser(id: string, phoneE164: string) {
  const user = await database.user.create({
    data: {
      id,
      name: id,
      email: `${id}@example.test`,
      emailVerified: true,
    },
  });
  await completeOnboarding(
    {
      intent: "CLIENT",
      accountKind: "PERSON",
      displayName: id,
      phoneE164,
      countryCode: "GE",
      city: "Tbilisi",
      activityDescription: "Initial description",
      preferredLocale: "ka",
      preferredCurrency: "GEL",
    },
    { id, emailVerified: true },
  );
  return user;
}

beforeEach(resetFixtures);
afterEach(resetFixtures);

describe("updateOwnProfile", () => {
  it("updates allowed fields and marks a changed phone unverified", async () => {
    await createOnboardedUser(ownerId, "+995555000020");
    await database.userProfile.update({
      where: { userId: ownerId },
      data: { phoneVerifiedAt: new Date("2026-08-14T12:00:00.000Z") },
    });

    const result = await updateOwnProfile(
      {
        displayName: "Updated Owner",
        city: "Kutaisi",
        phoneE164: "+995 555 000 021",
        preferredLocale: "en",
        preferredCurrency: "USD",
      },
      { id: ownerId },
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        userId: ownerId,
        displayName: "Updated Owner",
        city: "Kutaisi",
        phoneE164: "+995555000021",
        preferredLocale: "en",
        preferredCurrency: "USD",
      },
    });
    await expect(
      database.userProfile.findUnique({
        where: { userId: ownerId },
        select: { phoneVerifiedAt: true },
      }),
    ).resolves.toEqual({ phoneVerifiedAt: null });
  });

  it("updates only the actor's own profile", async () => {
    await createOnboardedUser(ownerId, "+995555000022");
    await createOnboardedUser(otherId, "+995555000023");

    await updateOwnProfile({ city: "Batumi" }, { id: ownerId });

    await expect(
      database.userProfile.findUnique({
        where: { userId: otherId },
        select: { city: true },
      }),
    ).resolves.toEqual({ city: "Tbilisi" });
  });

  it("strictly rejects capability and restriction fields", () => {
    expect(
      updateOwnProfileCommandSchema.safeParse({
        city: "Batumi",
        capabilities: ["ADMIN"],
        disabledAt: new Date(),
        restrictedUntil: new Date(),
      }).success,
    ).toBe(false);
  });
});
