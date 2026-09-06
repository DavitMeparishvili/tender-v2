import type { Locale } from "../../localization/config";

export type MailTemplate = "VERIFY_EMAIL" | "RESET_PASSWORD";

export type MailMessage = Readonly<{
  to: string;
  template: MailTemplate;
  locale: Locale;
  variables: Readonly<Record<string, string>>;
}>;

export interface MailSender {
  send(message: MailMessage): Promise<void>;
}
