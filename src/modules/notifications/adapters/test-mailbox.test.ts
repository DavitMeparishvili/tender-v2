import { describe, expect, it } from "vitest";
import { getTestMailbox, TestMailbox } from "./test-mailbox";

describe("TestMailbox", () => {
  it("captures the latest addressed verification message", async () => {
    const mailbox = new TestMailbox("test");
    await mailbox.send({
      to: "client@example.test",
      template: "VERIFY_EMAIL",
      locale: "ka",
      variables: {
        verificationUrl:
          "http://localhost:3000/api/auth/verify-email?token=secret",
      },
    });

    expect(
      mailbox.latestFor("client@example.test", "VERIFY_EMAIL")?.variables,
    ).toHaveProperty("verificationUrl");
  });

  it("cannot be enabled in production", () => {
    expect(() => new TestMailbox("production")).toThrow(
      "Test mailbox is unavailable in production",
    );
  });

  it("cannot return a cached mailbox to production", () => {
    getTestMailbox("test");

    expect(() => getTestMailbox("production")).toThrow(
      "Test mailbox is unavailable in production",
    );
  });
});
