import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { getServerEnv, type ServerEnv } from "../../../config/env";
import { database } from "../../../infrastructure/db/client";
import { LogMailSender } from "../../notifications/adapters/log-mail-sender";
import { getTestMailbox } from "../../notifications/adapters/test-mailbox";
import type { MailSender } from "../../notifications/ports/mail-sender";

type AuthDependencies = Readonly<{
  mailSender: MailSender;
  env?: ServerEnv;
}>;

async function preferredLocaleFor(userId: string): Promise<"ka" | "en"> {
  const profile = await database.userProfile.findUnique({
    where: { userId },
    select: { preferredLocale: true },
  });
  return profile?.preferredLocale === "en" ? "en" : "ka";
}

function anchorToAppUrl(generatedUrl: string, appUrl: string): string {
  const anchored = new URL(generatedUrl, appUrl);
  const configured = new URL(appUrl);
  anchored.protocol = configured.protocol;
  anchored.host = configured.host;
  return anchored.toString();
}

export function createAuth({
  mailSender,
  env = getServerEnv(),
}: AuthDependencies) {
  return betterAuth({
    appName: "Tender",
    baseURL: env.APP_URL,
    secret: env.AUTH_SECRET,
    database: prismaAdapter(database, { provider: "postgresql" }),
    trustedOrigins: [env.APP_URL],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        await mailSender.send({
          to: user.email,
          template: "RESET_PASSWORD",
          locale: await preferredLocaleFor(user.id),
          variables: { resetUrl: anchorToAppUrl(url, env.APP_URL) },
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => {
        await mailSender.send({
          to: user.email,
          template: "VERIFY_EMAIL",
          locale: await preferredLocaleFor(user.id),
          variables: {
            verificationUrl: anchorToAppUrl(url, env.APP_URL),
          },
        });
      },
    },
    advanced: {
      useSecureCookies: env.NODE_ENV === "production",
    },
  });
}

const env = getServerEnv();
const mailSender =
  env.NODE_ENV === "production"
    ? new LogMailSender()
    : getTestMailbox(env.NODE_ENV);

export const auth = createAuth({ mailSender, env });
