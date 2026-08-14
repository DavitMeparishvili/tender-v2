import type { MailMessage, MailSender } from "../ports/mail-sender";

type LogSink = (summary: string) => void;

function redactRecipient(address: string): string {
  const separator = address.lastIndexOf("@");
  if (separator <= 0 || separator === address.length - 1) {
    return "***";
  }

  return `${address[0]}***${address.slice(separator)}`;
}

export class LogMailSender implements MailSender {
  constructor(private readonly log: LogSink = console.info) {}

  async send(message: MailMessage): Promise<void> {
    this.log(
      `[mail] template=${message.template} recipient=${redactRecipient(message.to)} locale=${message.locale}`,
    );
  }
}
