import { afterEach, beforeEach, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { auth } from "../infrastructure/auth";
import { getCurrentUser } from "./current-user";

const email = "client@example.test";
const password = "correct-horse-battery-staple";

beforeEach(async () => {
  await database.user.deleteMany({ where: { email } });
});

afterEach(async () => {
  await database.user.deleteMany({ where: { email } });
});

it("loads the authenticated marketplace identity from a Better Auth session", async () => {
  const signUp = await auth.api.signUpEmail({
    body: {
      email,
      name: "Test Client",
      idNumber: "01010101010",
      cityOrTown: "Tbilisi",
      address: "12 Rustaveli Avenue, Tbilisi",
      password,
    },
  });

  await database.user.update({
    where: { id: signUp.user.id },
    data: {
      emailVerified: true,
      capabilities: {
        create: {
          id: "test-client-capability",
          code: "CUSTOMER",
        },
      },
      profile: {
        create: {
          id: "test-client-profile",
          accountKind: "PERSON",
          displayName: "Test Client",
          phoneE164: "+995555000001",
          countryCode: "GE",
          city: "Tbilisi",
          activityDescription: "Renovating a home",
          preferredLocale: "ka",
          preferredCurrency: "GEL",
          onboardingCompleteAt: new Date("2026-08-14T12:00:00.000Z"),
        },
      },
    },
  });

  const signIn = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });
  const cookie = signIn.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");

  await expect(getCurrentUser(new Headers({ cookie }))).resolves.toEqual({
    id: signUp.user.id,
    email,
    emailVerified: true,
    displayName: "Test Client",
    capabilities: ["CUSTOMER"],
    providerSpecialties: [],
    preferredLocale: "ka",
    preferredCurrency: "GEL",
    onboardingComplete: true,
    disabledAt: null,
    restrictedUntil: null,
  });
});

it("returns null when the request has no valid session", async () => {
  await expect(getCurrentUser(new Headers())).resolves.toBeNull();
});
