import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { database } from "../../../infrastructure/db/client";
import { getTestMailbox } from "../../notifications/adapters/test-mailbox";
import { auth } from "./auth";

const email = "mail-callbacks@example.test";
const appUrl = process.env.APP_URL ?? "http://localhost:3000";

beforeEach(async () => {
  await database.user.deleteMany({ where: { email } });
});

afterEach(async () => {
  await database.user.deleteMany({ where: { email } });
});

describe("Better Auth mail callbacks", () => {
  it("captures an APP_URL verification link with the fallback locale", async () => {
    await auth.api.signUpEmail({
      body: {
        email,
        name: "Mail Test",
        password: "correct-horse-battery-staple",
      },
    });

    const message = getTestMailbox("test").latestFor(email, "VERIFY_EMAIL");

    expect(message).toMatchObject({ to: email, locale: "ka" });
    expect(message?.variables.verificationUrl?.startsWith(appUrl)).toBe(true);
  });

  it("uses the persisted preferred locale for password recovery", async () => {
    const signUp = await auth.api.signUpEmail({
      body: {
        email,
        name: "Mail Test",
        password: "correct-horse-battery-staple",
      },
    });
    await database.user.update({
      where: { id: signUp.user.id },
      data: {
        profile: {
          create: {
            id: "mail-callback-profile",
            accountKind: "PERSON",
            displayName: "Mail Test",
            phoneE164: "+995555000002",
            countryCode: "GE",
            city: "Batumi",
            activityDescription: "Testing recovery mail",
            preferredLocale: "en",
            preferredCurrency: "GEL",
          },
        },
      },
    });

    await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: "http://localhost:3000/en/reset-password",
      },
    });

    const message = getTestMailbox("test").latestFor(email, "RESET_PASSWORD");

    expect(message).toMatchObject({ to: email, locale: "en" });
    expect(message?.variables.resetUrl?.startsWith(appUrl)).toBe(true);
  });
});
