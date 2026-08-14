import { getTestMailbox } from "../../../../src/modules/notifications/adapters/test-mailbox";
import { createMailboxHandler } from "../../../../src/modules/notifications/http/mailbox-handler";

const environment =
  process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test"
    ? process.env.NODE_ENV
    : "production";
const mailbox =
  environment === "production" ? null : getTestMailbox(environment);

export const GET = createMailboxHandler({
  environment,
  mailbox,
});
