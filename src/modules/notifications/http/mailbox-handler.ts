import type { TestMailbox } from "../adapters/test-mailbox";
import type { MailTemplate } from "../ports/mail-sender";

type MailboxReader = Pick<TestMailbox, "latestFor">;

type MailboxHandlerDependencies = Readonly<{
  environment: "development" | "test" | "production";
  mailbox: MailboxReader | null;
}>;

function isMailTemplate(value: string | null): value is MailTemplate {
  return value === "VERIFY_EMAIL" || value === "RESET_PASSWORD";
}

export function createMailboxHandler({
  environment,
  mailbox,
}: MailboxHandlerDependencies) {
  return async function GET(request: Request): Promise<Response> {
    if (environment === "production" || mailbox === null) {
      return Response.json({ code: "NOT_FOUND" }, { status: 404 });
    }

    const search = new URL(request.url).searchParams;
    const address = search.get("address");
    const template = search.get("template");
    if (address === null || address.length === 0 || !isMailTemplate(template)) {
      return Response.json({ code: "INVALID_QUERY" }, { status: 400 });
    }

    const message = mailbox.latestFor(address, template);
    if (message === undefined) {
      return Response.json({ code: "MESSAGE_NOT_FOUND" }, { status: 404 });
    }

    return Response.json({ message });
  };
}
