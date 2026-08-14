import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { getServerEnv, type ServerEnv } from "../../../config/env";
import { database } from "../../../infrastructure/db/client";
import { LogMailSender } from "../../notifications/adapters/log-mail-sender";
import type { MailSender } from "../../notifications/ports/mail-sender";

type AuthDependencies = Readonly<{
  mailSender: MailSender;
  env?: ServerEnv;
}>;

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
          locale: "ka",
          variables: { resetUrl: url },
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => {
        await mailSender.send({
          to: user.email,
          template: "VERIFY_EMAIL",
          locale: "ka",
          variables: { verificationUrl: url },
        });
      },
    },
    advanced: {
      useSecureCookies: env.NODE_ENV === "production",
    },
  });
}

export const auth = createAuth({ mailSender: new LogMailSender() });
