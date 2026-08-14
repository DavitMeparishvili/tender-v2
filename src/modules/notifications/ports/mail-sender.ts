export type MailTemplate = "VERIFY_EMAIL" | "RESET_PASSWORD";

export type MailMessage = Readonly<{
  to: string;
  template: MailTemplate;
  locale: "ka" | "en";
  variables: Readonly<Record<string, string>>;
}>;

export interface MailSender {
  send(message: MailMessage): Promise<void>;
}
