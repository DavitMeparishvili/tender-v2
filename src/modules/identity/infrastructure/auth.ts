import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { z } from "zod";
import { getServerEnv, type ServerEnv } from "../../../config/env";
import { database } from "../../../infrastructure/db/client";
import { createMailSender } from "../../notifications/adapters/create-mail-sender";
import type { MailSender } from "../../notifications/ports/mail-sender";
import {
  ADDRESS_MAX_LENGTH,
  ADDRESS_MIN_LENGTH,
  CITY_OR_TOWN_MAX_LENGTH,
  CITY_OR_TOWN_MIN_LENGTH,
  ID_NUMBER_PATTERN,
  normalizeRegistrationAddress,
} from "../domain/registration-details";

type AuthDependencies = Readonly<{
  mailSender: MailSender;
  env?: ServerEnv;
}>;

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
    user: {
      additionalFields: {
        idNumber: {
          type: "string",
          required: true,
          returned: false,
          validator: {
            input: z.string().trim().regex(ID_NUMBER_PATTERN),
          },
        },
        address: {
          type: "string",
          required: true,
          returned: false,
          validator: {
            input: z
              .string()
              .transform(normalizeRegistrationAddress)
              .pipe(z.string().min(ADDRESS_MIN_LENGTH).max(ADDRESS_MAX_LENGTH)),
          },
        },
        cityOrTown: {
          type: "string",
          required: true,
          returned: false,
          validator: {
            input: z
              .string()
              .trim()
              .min(CITY_OR_TOWN_MIN_LENGTH)
              .max(CITY_OR_TOWN_MAX_LENGTH),
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: 3600,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await mailSender.send({
          to: user.email,
          template: "RESET_PASSWORD",
          locale: "en",
          variables: { resetUrl: anchorToAppUrl(url, env.APP_URL) },
        });
      },
    },
    emailVerification: {
      autoSignInAfterVerification: true,
      sendOnSignUp: true,
      expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }) => {
        await mailSender.send({
          to: user.email,
          template: "VERIFY_EMAIL",
          locale: "en",
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
const mailSender = createMailSender(env);

export const auth = createAuth({ mailSender, env });
