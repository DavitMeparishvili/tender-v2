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

const containerStyle =
  "max-width:480px;margin:0 auto;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;line-height:1.5";

export class ResendMailSender implements MailSender {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly from: string | undefined,
    private readonly request: typeof fetch = fetch,
    private readonly appUrl: string | undefined = undefined,
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
      ? "Activate your Tender Market account"
      : "Reset your Tender Market password";
    const action = verification ? "Activate account" : "Reset password";
    const intro = verification
      ? "Welcome to Tender Market. Verify your email address to activate your account."
      : "We received a request to reset your Tender Market password.";
    const footer =
      "This link expires in 1 hour. If you did not request this email, you can ignore it.";
    const logo = this.appUrl
      ? `<img src="${escapeHtml(new URL("/brand/tender-market-email-logo.png", this.appUrl).href)}" width="120" height="120" alt="Tender Market" style="display:block;border:0">`
      : "";
    const button = `<a href="${escapeHtml(link)}" style="display:inline-block;background:#059669;color:#ffffff;padding:12px 24px;border-radius:8px;font-weight:600;text-decoration:none">${action}</a>`;
    let response: Response;
    try {
      response = await this.request("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `Tender Market <${this.from}>`,
          to: [message.to],
          subject,
          text: `${intro}\n\n${action}: ${link}\n\n${footer}`,
          html: `<html lang="en"><body style="margin:0;padding:16px"><div style="${containerStyle}">${logo}<h1 style="font-size:22px;line-height:1.3;margin:16px 0">${subject}</h1><p>${intro}</p><p>${button}</p><p style="color:#6b7280;font-size:13px">${footer}</p></div></body></html>`,
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
