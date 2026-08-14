import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import {
  completeOnboarding,
  completeOnboardingCommandSchema,
  type CompleteOnboardingCommand,
} from "./complete-onboarding";

const userIds = [
  "onboarding-client",
  "onboarding-provider",
  "onboarding-unverified",
  "onboarding-conflict-a",
  "onboarding-conflict-b",
] as const;

const baseCommand: CompleteOnboardingCommand = {
  intent: "CLIENT",
  accountKind: "PERSON",
  displayName: "Test Client",
  phoneE164: "+995555000010",
  countryCode: "GE",
  city: "Tbilisi",
  activityDescription: "Renovating an apartment",
  preferredLocale: "ka",
  preferredCurrency: "GEL",
};

async function resetFixtures() {
  await database.auditEvent.deleteMany({
    where: { actorId: { in: [...userIds] } },
  });
  await database.user.deleteMany({ where: { id: { in: [...userIds] } } });
}

async function createUser(id: (typeof userIds)[number], verified = true) {
  return database.user.create({
    data: {
      id,
      name: id,
      email: `${id}@example.test`,
      emailVerified: verified,
    },
  });
}

beforeEach(resetFixtures);
afterEach(resetFixtures);

describe("completeOnboarding", () => {
  it("atomically completes verified client onboarding", async () => {
    const user = await createUser("onboarding-client");

    const result = await completeOnboarding(baseCommand, {
      id: user.id,
      emailVerified: user.emailVerified,
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        userId: user.id,
        displayName: "Test Client",
        phoneE164: "+995555000010",
        capabilities: ["CUSTOMER"],
        providerSpecialties: [],
      },
    });
    await expect(
      database.auditEvent.count({ where: { actorId: user.id } }),
    ).resolves.toBe(1);
  });

  it("grants only provider capability and construction specialty", async () => {
    const user = await createUser("onboarding-provider");

    const result = await completeOnboarding(
      {
        ...baseCommand,
        intent: "CONSTRUCTION_PROVIDER",
        accountKind: "COMPANY",
        displayName: "Build Co",
        phoneE164: "+995555000011",
      },
      { id: user.id, emailVerified: user.emailVerified },
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        capabilities: ["PROVIDER"],
        providerSpecialties: ["CONSTRUCTION_REPAIR"],
      },
    });
  });

  it("rejects an unverified user without writing a profile", async () => {
    const user = await createUser("onboarding-unverified", false);

    await expect(
      completeOnboarding(baseCommand, {
        id: user.id,
        emailVerified: user.emailVerified,
      }),
    ).resolves.toEqual({ ok: false, error: "EMAIL_UNVERIFIED" });
    await expect(
      database.userProfile.findUnique({ where: { userId: user.id } }),
    ).resolves.toBeNull();
  });

  it("normalizes phone numbers before enforcing uniqueness", async () => {
    const first = await createUser("onboarding-conflict-a");
    const second = await createUser("onboarding-conflict-b");
    await completeOnboarding(
      { ...baseCommand, phoneE164: "+995 555 000 012" },
      { id: first.id, emailVerified: first.emailVerified },
    );

    await expect(
      completeOnboarding(
        { ...baseCommand, phoneE164: "+995-555-000-012" },
        { id: second.id, emailVerified: second.emailVerified },
      ),
    ).resolves.toEqual({ ok: false, error: "PHONE_CONFLICT" });
  });

  it("strictly rejects admin and unknown public input", () => {
    expect(
      completeOnboardingCommandSchema.safeParse({
        ...baseCommand,
        intent: "ADMIN",
        capabilities: ["ADMIN"],
        restrictedUntil: "2099-01-01T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("returns the existing result when a completed command is retried", async () => {
    const user = await createUser("onboarding-client");

    const first = await completeOnboarding(baseCommand, {
      id: user.id,
      emailVerified: user.emailVerified,
    });
    const retry = await completeOnboarding(baseCommand, {
      id: user.id,
      emailVerified: user.emailVerified,
    });

    expect(retry).toEqual(first);
    await expect(
      database.userCapability.count({ where: { userId: user.id } }),
    ).resolves.toBe(1);
    await expect(
      database.auditEvent.count({ where: { actorId: user.id } }),
    ).resolves.toBe(1);
  });
});
