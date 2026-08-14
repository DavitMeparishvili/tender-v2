import { expect, it, vi } from "vitest";
import { LogMailSender } from "./log-mail-sender";

it("logs only the template and a redacted recipient", async () => {
  const log = vi.fn<(summary: string) => void>();
  const sender = new LogMailSender(log);

  await sender.send({
    to: "client@example.test",
    template: "VERIFY_EMAIL",
    locale: "ka",
    variables: {
      verificationUrl: "http://localhost:3000/api/auth/verify?token=secret",
    },
  });

  expect(log).toHaveBeenCalledWith(
    "[mail] template=VERIFY_EMAIL recipient=c***@example.test locale=ka",
  );
  expect(log.mock.calls.flat().join(" ")).not.toContain("token=secret");
  expect(log.mock.calls.flat().join(" ")).not.toContain("client@example.test");
});
