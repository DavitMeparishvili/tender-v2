# Account email delivery

Account activation and password recovery use Better Auth and Resend. Both emails
are English, regardless of the interface or profile language. Links expire after
one hour. Password reset revokes existing sessions. Verification is required to
sign in, and successful verification signs the user in automatically.

## Production setup

1. Create a Resend account and add a domain you own (a sending subdomain is fine).
2. Add the DNS records shown by Resend and wait until the domain is verified.
3. Create a sending API key restricted to that domain.
4. Set `RESEND_API_KEY` and `MAIL_FROM` in the deployment environment.
   `MAIL_FROM` is a bare address, such as `accounts@mail.example.com`, on the
   verified domain. The app adds the display name `Tender`.
   For this deployment, use `MAIL_FROM=accounts@email.tender-market.online`
   after verifying `email.tender-market.online` in Resend.
5. Set `APP_URL` to the public HTTPS origin and restart/redeploy the app.
   Docker deployments read these values from `deploy/.env.droplet`.
6. Register a new test account, follow its activation email, sign out, request a
   password reset, follow the link, and sign in with the new password. Check
   Resend's delivery dashboard and the recipient's spam folder if needed.

Keep API keys out of source control and browser variables. Leave click tracking
disabled for authentication links. The Resend sandbox sender is for testing and
cannot deliver to arbitrary initial users; verify your domain before launch.

Production uses real delivery and throws on missing credentials or provider
failures; it never falls back to log-only delivery. Credentials are checked when
sending so builds can run without email secrets. Requests time out after 10 seconds.
There is no background retry queue: users can retry using the existing resend or
recovery forms. Errors do not contain recipient addresses, tokens, or raw provider
responses. A provider accepting a request does not guarantee inbox delivery.

## Local development and tests

Without either email variable, development keeps the existing test mailbox.
Set both variables to exercise real delivery locally. Automated tests always use
the test mailbox, even if credentials are present. No provider SDK is required:
the adapter calls Resend's HTTPS API using server-side fetch.

Next.js reads local credentials from the Git-ignored `.env.local`. Restart the
development server after changing them. Browser test servers explicitly clear
both mail variables so they cannot use these real credentials.

## Provider choice

Checked September 29, 2026: [Resend](https://resend.com/pricing) offers 3,000 emails
per month with a 100/day cap on Free, sufficient for a small demo.
[Brevo](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans)
offers 300/day on Free.
[SendGrid](https://www.twilio.com/docs/sendgrid/ui/account-and-settings/upgrading-your-plan)
offers a 60-day free trial, so it is not the best fit for an ongoing free demo.
Domain registration costs are separate from email sending.
