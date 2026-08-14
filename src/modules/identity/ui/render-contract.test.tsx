import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuthState } from "./auth-state";
import { ErrorSummary, SubmitButton } from "./identity-form";
import { Field } from "./field";

describe("identity UI render contract", () => {
  it("connects a field label, description, and error", () => {
    const html = renderToStaticMarkup(
      <Field
        id="email"
        label="Email"
        description="Use your work address."
        error="Enter a valid email."
      >
        <input name="email" type="email" autoComplete="email" />
      </Field>,
    );

    expect(html).toContain('for="email"');
    expect(html).toContain('id="email"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="email-description email-error"');
  });

  it("renders a focusable alert summary linked to invalid fields", () => {
    const html = renderToStaticMarkup(
      <ErrorSummary
        issues={[
          { field: "email", message: "Enter a valid email." },
          { field: "password", message: "Use at least 8 characters." },
        ]}
        summaryOne="There is 1 problem to fix."
        summaryMany="There are {count} problems to fix."
      />,
    );

    expect(html).toContain('id="form-errors"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('href="#email"');
    expect(html).toContain('href="#password"');
    expect(html).toContain("There are 2 problems to fix.");
  });

  it("keeps the action label visible while pending", () => {
    const html = renderToStaticMarkup(
      <SubmitButton
        label="Create account"
        pendingLabel="Creating account"
        isPending
      />,
    );

    expect(html).toContain("Create account");
    expect(html).toContain("Creating account");
    expect(html).toContain("disabled");
  });

  it("renders a safe state without receiving raw token diagnostics", () => {
    const html = renderToStaticMarkup(
      <AuthState
        state="expired"
        title="This link has expired"
        body="Request a fresh link."
        action={{ href: "/en/forgot-password", label: "Request link" }}
      />,
    );

    expect(html).toContain('data-auth-state="expired"');
    expect(html).toContain('href="/en/forgot-password"');
    expect(html).not.toContain("token");
  });
});
