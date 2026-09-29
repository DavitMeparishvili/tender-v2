import type { MailMessage, MailSender } from "../ports/mail-sender";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character]!;
  });
}

export class ResendMailSender implements MailSender {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly from: string | undefined,
    private readonly request: typeof fetch = fetch,
  ) {}

  async send(message: MailMessage): Promise<void> {
    // Validate at send time so production builds do not need runtime secrets.
    if (!this.apiKey || !this.from) {
      throw new Error("Email delivery requires RESEND_API_KEY and MAIL_FROM");
    }

    const verification = message.template === "VERIFY_EMAIL";
    const link =
      message.variables[verification ? "verificationUrl" : "resetUrl"];
    if (!link || !["https:", "http:"].includes(new URL(link).protocol)) {
      throw new Error("Email requires a valid HTTP(S) action URL");
    }
    const subject = verification
      ? "Activate your Tender account"
      : "Reset your Tender password";
    const action = verification ? "Activate account" : "Reset password";
    const intro = verification
      ? "Welcome to Tender. Verify your email address to activate your account."
      : "We received a request to reset your Tender password.";
    const footer =
      "This link expires in 1 hour. If you did not request this email, you can ignore it.";
    let response: Response;
    try {
      response = await this.request("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `Tender <${this.from}>`,
          to: [message.to],
          subject,
          text: `${intro}\n\n${action}: ${link}\n\n${footer}`,
          html: `<html lang="en"><body><h1>${subject}</h1><p>${intro}</p><p><a href="${escapeHtml(link)}">${action}</a></p><p>Or copy this link into your browser:</p><p>${escapeHtml(link)}</p><p>${footer}</p></body></html>`,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      // Never include provider responses, recipient addresses, or token URLs in errors.
      throw new Error("Email delivery could not reach Resend");
    }
    if (!response.ok) {
      throw new Error(`Email delivery failed (Resend HTTP ${response.status})`);
    }
  }
}
