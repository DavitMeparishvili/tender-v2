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
        {
          name: "A",
          idNumber: "123",
          cityOrTown: "",
          address: " ",
          email: "not-an-email",
          password: "short",
        },
        messages,
      ),
    ).toEqual({
      ok: false,
      issues: [
        { field: "name", message: messages.errors.nameLength },
        { field: "idNumber", message: messages.errors.invalidIdNumber },
        {
          field: "cityOrTown",
          message: messages.errors.cityOrTownLength,
        },
        { field: "address", message: messages.errors.addressLength },
        { field: "email", message: messages.errors.invalidEmail },
        { field: "password", message: messages.errors.passwordLength },
      ],
    });
  });

  it("normalizes valid registration identity details", () => {
    expect(
      parseRegistration(
        {
          name: "  Tender Client  ",
          idNumber: "01010101010",
          cityOrTown: "  Tbilisi  ",
          address: "  12 Rustaveli Avenue, Tbilisi  ",
          email: "  CLIENT@example.com ",
          password: "strong-password",
          confirmPassword: "strong-password",
        },
        messages,
      ),
    ).toEqual({
      ok: true,
      value: {
        name: "Tender Client",
        idNumber: "01010101010",
        cityOrTown: "Tbilisi",
        address: "12 Rustaveli Avenue, Tbilisi",
        email: "client@example.com",
        password: "strong-password",
      },
    });
  });

  it("rejects mismatched registration passwords", () => {
    const result = parseRegistration(
      {
        name: "Tender Client",
        idNumber: "01010101010",
        cityOrTown: "Tbilisi",
        address: "12 Rustaveli Avenue",
        email: "client@example.com",
        password: "strong-password",
        confirmPassword: "different-password",
      },
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
