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
  it("activates an account and resets its password with a single-use token", async () => {
    const password = "original-password-for-mail-test";
    const newPassword = "replacement-password-for-mail-test";
    const { user } = await auth.api.signUpEmail({
      body: {
        email,
        name: "Lifecycle Test",
        idNumber: "01010101010",
        cityOrTown: "Tbilisi",
        address: "12 Rustaveli Avenue",
        password,
      },
    });
    await expect(
      auth.api.signInEmail({ body: { email, password } }),
    ).rejects.toThrow();
    const verification = getTestMailbox("test").latestFor(
      email,
      "VERIFY_EMAIL",
    )!;
    const token = new URL(
      verification.variables.verificationUrl!,
    ).searchParams.get("token")!;
    await auth.api.verifyEmail({ query: { token } });
    expect(
      (await database.user.findUniqueOrThrow({ where: { id: user.id } }))
        .emailVerified,
    ).toBe(true);
    await auth.api.signInEmail({ body: { email, password } });
    expect(
      await database.session.count({ where: { userId: user.id } }),
    ).toBeGreaterThan(0);
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: `${appUrl}/en/reset-password` },
    });
    const recovery = getTestMailbox("test").latestFor(email, "RESET_PASSWORD")!;
    const resetToken = new URL(recovery.variables.resetUrl!).pathname
      .split("/")
      .at(-1)!;
    await auth.api.resetPassword({ body: { token: resetToken, newPassword } });
    expect(await database.session.count({ where: { userId: user.id } })).toBe(
      0,
    );
    await expect(
      auth.api.resetPassword({ body: { token: resetToken, newPassword } }),
    ).rejects.toThrow();
    await expect(
      auth.api.signInEmail({ body: { email, password } }),
    ).rejects.toThrow();
    await expect(
      auth.api.signInEmail({ body: { email, password: newPassword } }),
    ).resolves.toHaveProperty("user.id", user.id);
  });

  it("captures an APP_URL verification link in English", async () => {
    const signUp = await auth.api.signUpEmail({
      body: {
        email,
        name: "Mail Test",
        idNumber: " 01010101010 ",
        cityOrTown: " Tbilisi ",
        address: " 12   Rustaveli Avenue, Tbilisi ",
        password: "correct-horse-battery-staple",
      },
    });

    const message = getTestMailbox("test").latestFor(email, "VERIFY_EMAIL");
    const registrationDetails = await database.user.findUniqueOrThrow({
      where: { id: signUp.user.id },
      select: { idNumber: true, cityOrTown: true, address: true },
    });

    expect(message).toMatchObject({ to: email, locale: "en" });
    expect(message?.variables.verificationUrl?.startsWith(appUrl)).toBe(true);
    expect(registrationDetails).toEqual({
      idNumber: "01010101010",
      cityOrTown: "Tbilisi",
      address: "12 Rustaveli Avenue, Tbilisi",
    });
    expect(signUp.user).not.toHaveProperty("idNumber");
    expect(signUp.user).not.toHaveProperty("cityOrTown");
    expect(signUp.user).not.toHaveProperty("address");
  });

  it("uses English for password recovery regardless of profile language", async () => {
    const signUp = await auth.api.signUpEmail({
      body: {
        email,
        name: "Mail Test",
        idNumber: "01010101010",
        cityOrTown: "Tbilisi",
        address: "12 Rustaveli Avenue, Tbilisi",
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
            preferredLocale: "ka",
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
