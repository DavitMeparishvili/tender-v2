import type { ServerEnv } from "../../../config/env";
import type { MailSender } from "../ports/mail-sender";
import { ResendMailSender } from "./resend-mail-sender";
import { getTestMailbox } from "./test-mailbox";

export function createMailSender(env: ServerEnv): MailSender {
  if (env.NODE_ENV === "test") return getTestMailbox("test");
  if (env.NODE_ENV === "production" || env.RESEND_API_KEY || env.MAIL_FROM) {
    return new ResendMailSender(
      env.RESEND_API_KEY,
      env.MAIL_FROM,
      fetch,
      env.APP_URL,
    );
  }
  return getTestMailbox("development");
}
