import type {
  MailMessage,
  MailSender,
  MailTemplate,
} from "../ports/mail-sender";

function assertMailboxEnvironment(
  environment: string | undefined,
): asserts environment is "development" | "test" {
  if (environment !== "development" && environment !== "test") {
    throw new Error("Test mailbox is unavailable in production");
  }
}

export class TestMailbox implements MailSender {
  private readonly messages: MailMessage[] = [];

  constructor(environment: string | undefined = process.env.NODE_ENV) {
    assertMailboxEnvironment(environment);
  }

  async send(message: MailMessage): Promise<void> {
    this.messages.push({
      ...message,
      variables: { ...message.variables },
    });
  }

  latestFor(address: string, template: MailTemplate): MailMessage | undefined {
    return this.messages.findLast(
      (message) => message.to === address && message.template === template,
    );
  }
}

const mailboxGlobal = globalThis as typeof globalThis & {
  testMailbox?: TestMailbox;
};

export function getTestMailbox(
  environment: string | undefined = process.env.NODE_ENV,
): TestMailbox {
  assertMailboxEnvironment(environment);
  const mailbox = mailboxGlobal.testMailbox ?? new TestMailbox(environment);
  mailboxGlobal.testMailbox = mailbox;
  return mailbox;
}
