import { describe, expect, it } from "vitest";
import { TestMailbox } from "../../../../src/modules/notifications/adapters/test-mailbox";
import { createMailboxHandler } from "./route";

describe("test mailbox route", () => {
  it("returns 404 in production without consulting a mailbox", async () => {
    const handler = createMailboxHandler({
      environment: "production",
      mailbox: null,
    });

    const response = await handler(
      new Request(
        "http://localhost/api/test/mailbox?address=client@example.test&template=VERIFY_EMAIL",
      ),
    );

    expect(response.status).toBe(404);
  });

  it("returns only the message addressed by the query", async () => {
    const mailbox = new TestMailbox("test");
    await mailbox.send({
      to: "client@example.test",
      template: "VERIFY_EMAIL",
      locale: "en",
      variables: { verificationUrl: "http://localhost/verify?token=client" },
    });
    await mailbox.send({
      to: "other@example.test",
      template: "VERIFY_EMAIL",
      locale: "ka",
      variables: { verificationUrl: "http://localhost/verify?token=other" },
    });
    const handler = createMailboxHandler({
      environment: "test",
      mailbox,
    });

    const response = await handler(
      new Request(
        "http://localhost/api/test/mailbox?address=client%40example.test&template=VERIFY_EMAIL",
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: {
        to: "client@example.test",
        template: "VERIFY_EMAIL",
        locale: "en",
        variables: {
          verificationUrl: "http://localhost/verify?token=client",
        },
      },
    });
  });

  it("does not allow unaddressed mailbox listing", async () => {
    const handler = createMailboxHandler({
      environment: "test",
      mailbox: new TestMailbox("test"),
    });

    const response = await handler(
      new Request("http://localhost/api/test/mailbox"),
    );

    expect(response.status).toBe(400);
  });
});
