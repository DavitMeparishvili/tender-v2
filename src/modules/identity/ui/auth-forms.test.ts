import { describe, expect, it } from "vitest";
import { getMessages } from "../../localization/get-messages";
import {
  parseLogin,
  parseRegistration,
  parseResetPassword,
} from "./auth-forms";

const messages = getMessages("en");

describe("identity form validation", () => {
  it("returns field-specific registration issues", () => {
    expect(
      parseRegistration(
        { name: "A", email: "not-an-email", password: "short" },
        messages,
      ),
    ).toEqual({
      ok: false,
      issues: [
        { field: "name", message: messages.errors.nameLength },
        { field: "email", message: messages.errors.invalidEmail },
        { field: "password", message: messages.errors.passwordLength },
      ],
    });
  });

  it("normalizes valid sign-in input", () => {
    expect(
      parseLogin(
        { email: "  OWNER@example.com ", password: "valid-pass" },
        messages,
      ),
    ).toEqual({
      ok: true,
      value: { email: "owner@example.com", password: "valid-pass" },
    });
  });

  it("rejects mismatched reset passwords without echoing a token", () => {
    const result = parseResetPassword(
      { password: "long-enough", confirmPassword: "different" },
      messages,
    );

    expect(result).toEqual({
      ok: false,
      issues: [
        {
          field: "confirmPassword",
          message: messages.errors.passwordMismatch,
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("token");
  });
});
