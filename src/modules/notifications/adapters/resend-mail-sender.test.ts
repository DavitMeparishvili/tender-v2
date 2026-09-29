import { describe, expect, it, vi } from "vitest";
import type { MailMessage } from "../ports/mail-sender";
import { ResendMailSender } from "./resend-mail-sender";
import { createMailSender } from "./create-mail-sender";
import type { ServerEnv } from "../../../config/env";
import { TestMailbox } from "./test-mailbox";

const message: MailMessage = {
  to: "user@example.test",
  template: "VERIFY_EMAIL",
  locale: "en",
  variables: {
    verificationUrl: "https://example.test/verify?token=secret&next=%22",
  },
};

describe("Resend mail delivery", () => {
  it.each(["VERIFY_EMAIL", "RESET_PASSWORD"] as const)(
    "sends %s as English HTML and plain text",
    async (template) => {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('{"id":"mail-id"}'));
      const sender = new ResendMailSender(
        "test-key",
        "accounts@example.test",
        request,
      );
      const link = message.variables.verificationUrl!;
      await sender.send({
        ...message,
        template,
        variables: { verificationUrl: link, resetUrl: link },
      });
      expect(request).toHaveBeenCalledOnce();
      const [url, options] = request.mock.calls[0]!;
      expect(url).toBe("https://api.resend.com/emails");
      expect(options?.headers).toMatchObject({
        Authorization: "Bearer test-key",
      });
      const body = JSON.parse(options?.body as string);
      expect(body).toMatchObject({
        from: "Tender <accounts@example.test>",
        to: [message.to],
      });
      expect(body.subject).toBe(
        template === "VERIFY_EMAIL"
          ? "Activate your Tender account"
          : "Reset your Tender password",
      );
      expect(body.text).toContain(link);
      expect(body.html).toContain("&amp;next=");
      expect(body.html).toContain('lang="en"');
      expect(options?.signal).toBeInstanceOf(AbortSignal);
    },
  );

  it.each([401, 429, 500])(
    "reports HTTP %s without exposing the provider response",
    async (status) => {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response("sensitive provider response", { status }),
        );
      await expect(
        new ResendMailSender("key", "a@example.test", request).send(message),
      ).rejects.toThrow(`Email delivery failed (Resend HTTP ${status})`);
    },
  );

  it("sanitizes network failures", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("secret token"));
    await expect(
      new ResendMailSender("key", "a@example.test", request).send(message),
    ).rejects.toThrow("Email delivery could not reach Resend");
  });

  it("rejects missing configuration before sending", async () => {
    const request = vi.fn<typeof fetch>();
    await expect(
      new ResendMailSender(undefined, undefined, request).send(message),
    ).rejects.toThrow("RESEND_API_KEY and MAIL_FROM");
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects unsafe action links", async () => {
    const request = vi.fn<typeof fetch>();
    await expect(
      new ResendMailSender("key", "a@example.test", request).send({
        ...message,
        variables: { verificationUrl: "javascript:alert(1)" },
      }),
    ).rejects.toThrow("HTTP(S)");
    expect(request).not.toHaveBeenCalled();
  });

  it("keeps tests offline even when credentials exist and never logs production mail as sent", async () => {
    expect(
      createMailSender({
        NODE_ENV: "test",
        RESEND_API_KEY: "key",
        MAIL_FROM: "a@example.test",
      } as ServerEnv),
    ).toBeInstanceOf(TestMailbox);
    expect(
      createMailSender({ NODE_ENV: "development" } as ServerEnv),
    ).toBeInstanceOf(TestMailbox);
    const production = createMailSender({
      NODE_ENV: "production",
    } as ServerEnv);
    expect(production).toBeInstanceOf(ResendMailSender);
    await expect(production.send(message)).rejects.toThrow("RESEND_API_KEY");
  });
});
