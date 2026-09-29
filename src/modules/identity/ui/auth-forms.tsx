"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import {
  ADDRESS_MAX_LENGTH,
  ADDRESS_MIN_LENGTH,
  CITY_OR_TOWN_MAX_LENGTH,
  CITY_OR_TOWN_MIN_LENGTH,
  ID_NUMBER_PATTERN,
  normalizeRegistrationAddress,
} from "../domain/registration-details";
import { AuthState } from "./auth-state";
import {
  ErrorSummary,
  SubmitButton,
  focusErrorSummary,
  type FormIssue,
} from "./identity-form";
import { Field } from "./field";

type ParseResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; issues: readonly FormIssue[] }>;
type FormSource = FormData | Readonly<Record<string, unknown>>;

function read(source: FormSource, key: string): string {
  const value =
    source instanceof FormData ? source.get(key) : (source[key] ?? "");
  return typeof value === "string" ? value : "";
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function parseRegistration(
  source: FormSource,
  messages: Messages,
): ParseResult<
  Readonly<{
    name: string;
    idNumber: string;
    cityOrTown: string;
    address: string;
    email: string;
    password: string;
  }>
> {
  const name = read(source, "name").trim();
  const idNumber = read(source, "idNumber").trim();
  const cityOrTown = read(source, "cityOrTown").trim();
  const address = normalizeRegistrationAddress(read(source, "address"));
  const email = read(source, "email").trim().toLowerCase();
  const password = read(source, "password");
  const confirmation = read(source, "confirmPassword");
  const issues: FormIssue[] = [];

  if (name.length < 2 || name.length > 120) {
    issues.push({ field: "name", message: messages.errors.nameLength });
  }
  if (!ID_NUMBER_PATTERN.test(idNumber)) {
    issues.push({
      field: "idNumber",
      message: messages.errors.invalidIdNumber,
    });
  }
  if (
    cityOrTown.length < CITY_OR_TOWN_MIN_LENGTH ||
    cityOrTown.length > CITY_OR_TOWN_MAX_LENGTH
  ) {
    issues.push({
      field: "cityOrTown",
      message: messages.errors.cityOrTownLength,
    });
  }
  if (
    address.length < ADDRESS_MIN_LENGTH ||
    address.length > ADDRESS_MAX_LENGTH
  ) {
    issues.push({ field: "address", message: messages.errors.addressLength });
  }
  if (!validEmail(email)) {
    issues.push({ field: "email", message: messages.errors.invalidEmail });
  }
  if (password.length < 8) {
    issues.push({
      field: "password",
      message: messages.errors.passwordLength,
    });
  } else if (password !== confirmation) {
    issues.push({
      field: "confirmPassword",
      message: messages.errors.passwordMismatch,
    });
  }
  return issues.length > 0
    ? { ok: false, issues }
    : {
        ok: true,
        value: { name, idNumber, cityOrTown, address, email, password },
      };
}

export function parseLogin(
  source: FormSource,
  messages: Messages,
): ParseResult<Readonly<{ email: string; password: string }>> {
  const email = read(source, "email").trim().toLowerCase();
  const password = read(source, "password");
  const issues: FormIssue[] = [];

  if (!validEmail(email)) {
    issues.push({ field: "email", message: messages.errors.invalidEmail });
  }
  if (password.length === 0) {
    issues.push({ field: "password", message: messages.errors.required });
  }
  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: { email, password } };
}

export function parseResetPassword(
  source: FormSource,
  messages: Messages,
): ParseResult<Readonly<{ password: string }>> {
  const password = read(source, "password");
  const confirmation = read(source, "confirmPassword");
  const issues: FormIssue[] = [];

  if (password.length < 8) {
    issues.push({
      field: "password",
      message: messages.errors.passwordLength,
    });
  } else if (password !== confirmation) {
    issues.push({
      field: "confirmPassword",
      message: messages.errors.passwordMismatch,
    });
  }
  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: { password } };
}

function issueFor(issues: readonly FormIssue[], field: string) {
  return issues.find((issue) => issue.field === field)?.message;
}

function focusIssues() {
  queueMicrotask(() => focusErrorSummary());
}

type AuthFormProps = Readonly<{ locale: Locale; messages: Messages }>;
type RegistrationFormProps = AuthFormProps &
  Readonly<{ intent: "CLIENT" | "CONSTRUCTION_PROVIDER" }>;

export function RegistrationForm({
  locale,
  messages,
  intent,
}: RegistrationFormProps) {
  const [issues, setIssues] = useState<readonly FormIssue[]>([]);
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  if (registeredEmail !== null) {
    return (
      <AuthState
        state="success"
        title={messages.auth.verificationSentTitle}
        body={messages.auth.verificationSentBody.replace(
          "{email}",
          registeredEmail,
        )}
        action={{ href: "/" + locale + "/login", label: messages.auth.signIn }}
        secondaryAction={{
          href:
            "/" +
            locale +
            "/register/" +
            (intent === "CLIENT" ? "client" : "provider"),
          label: messages.auth.wrongAddress,
        }}
      />
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = parseRegistration(
      new FormData(event.currentTarget),
      messages,
    );
    if (!parsed.ok) {
      setIssues(parsed.issues);
      focusIssues();
      return;
    }

    setPending(true);
    setIssues([]);
    const { authClient } = await import("../infrastructure/auth-client");
    const result = await authClient.signUp.email({
      ...parsed.value,
      callbackURL: "/" + locale + "/continue?intent=" + intent,
    });
    setPending(false);
    if (result.error) {
      setIssues([{ field: "email", message: messages.errors.generic }]);
      focusIssues();
      return;
    }
    setDirty(false);
    setRegisteredEmail(parsed.value.email);
  }

  return (
    <form
      className="identity-form"
      data-dirty={dirty ? "true" : "false"}
      noValidate
      onInput={() => setDirty(true)}
      onSubmit={submit}
    >
      <ErrorSummary
        issues={issues}
        summaryOne={messages.errors.summaryOne}
        summaryMany={messages.errors.summaryMany}
      />
      <div className="registration-fields">
        <Field
          id="name"
          label={messages.auth.name}
          description={messages.auth.nameDescription}
          error={issueFor(issues, "name")}
        >
          <input
            name="name"
            type="text"
            autoComplete="name"
            maxLength={120}
            required
          />
        </Field>
        <Field
          id="idNumber"
          label={messages.auth.idNumber}
          description={messages.auth.idNumberDescription}
          error={issueFor(issues, "idNumber")}
        >
          <input
            name="idNumber"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={11}
            pattern="[0-9]*"
            required
          />
        </Field>
        <Field
          id="cityOrTown"
          label={messages.auth.cityOrTown}
          description={messages.auth.cityOrTownDescription}
          error={issueFor(issues, "cityOrTown")}
        >
          <input
            name="cityOrTown"
            type="text"
            autoComplete="address-level2"
            maxLength={CITY_OR_TOWN_MAX_LENGTH}
            required
          />
        </Field>
        <Field
          id="address"
          label={messages.auth.address}
          description={messages.auth.addressDescription}
          error={issueFor(issues, "address")}
        >
          <input
            name="address"
            type="text"
            autoComplete="street-address"
            maxLength={ADDRESS_MAX_LENGTH}
            required
          />
        </Field>
        <div className="registration-field-wide">
          <Field
            id="email"
            label={messages.auth.email}
            description={messages.auth.emailDescription}
            error={issueFor(issues, "email")}
          >
            <input
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
            />
          </Field>
        </div>
        <Field
          id="password"
          label={messages.auth.password}
          description={messages.auth.passwordDescription}
          error={issueFor(issues, "password")}
        >
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
        <Field
          id="confirmPassword"
          label={messages.auth.confirmPassword}
          error={issueFor(issues, "confirmPassword")}
        >
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
      </div>
      <SubmitButton
        label={messages.auth.createAccount}
        pendingLabel={messages.auth.creatingAccount}
        isPending={pending}
      />
      <p className="form-footer">
        {messages.auth.haveAccount}{" "}
        <Link href={"/" + locale + "/login"}>{messages.auth.signIn}</Link>
      </p>
    </form>
  );
}

export function LoginForm({ locale, messages }: AuthFormProps) {
  const [issues, setIssues] = useState<readonly FormIssue[]>([]);
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = parseLogin(new FormData(event.currentTarget), messages);
    if (!parsed.ok) {
      setIssues(parsed.issues);
      focusIssues();
      return;
    }

    setPending(true);
    setIssues([]);
    const { authClient } = await import("../infrastructure/auth-client");
    const result = await authClient.signIn.email(parsed.value);
    if (result.error) {
      setPending(false);
      setIssues([{ field: "email", message: messages.errors.generic }]);
      focusIssues();
      return;
    }
    setDirty(false);
    window.location.assign("/" + locale + "/continue");
  }

  return (
    <form
      className="identity-form"
      data-dirty={dirty ? "true" : "false"}
      noValidate
      onInput={() => setDirty(true)}
      onSubmit={submit}
    >
      <ErrorSummary
        issues={issues}
        summaryOne={messages.errors.summaryOne}
        summaryMany={messages.errors.summaryMany}
      />
      <Field
        id="email"
        label={messages.auth.email}
        error={issueFor(issues, "email")}
      >
        <input name="email" type="email" autoComplete="email" />
      </Field>
      <Field
        id="password"
        label={messages.auth.password}
        error={issueFor(issues, "password")}
      >
        <input
          name="password"
          type="password"
          autoComplete="current-password"
        />
      </Field>
      <div className="form-link-row">
        <Link href={"/" + locale + "/forgot-password"}>
          {messages.auth.forgotPassword}
        </Link>
      </div>
      <SubmitButton
        label={messages.auth.signIn}
        pendingLabel={messages.auth.signingIn}
        isPending={pending}
      />
      <p className="form-footer">
        {messages.auth.needAccount}{" "}
        <Link href={"/" + locale + "/register"}>{messages.auth.register}</Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm({ locale, messages }: AuthFormProps) {
  const [issues, setIssues] = useState<readonly FormIssue[]>([]);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <AuthState
        state="success"
        title={messages.auth.resetSentTitle}
        body={messages.auth.resetSentBody}
        action={{ href: "/" + locale + "/login", label: messages.auth.signIn }}
      />
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const email = read(new FormData(event.currentTarget), "email")
      .trim()
      .toLowerCase();
    if (!validEmail(email)) {
      setIssues([{ field: "email", message: messages.errors.invalidEmail }]);
      focusIssues();
      return;
    }

    setPending(true);
    setIssues([]);
    try {
      const { authClient } = await import("../infrastructure/auth-client");
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: window.location.origin + "/" + locale + "/reset-password",
      });
      if (result.error) throw new Error("Recovery request failed");
      setSent(true);
    } catch {
      setIssues([{ field: "email", message: messages.errors.generic }]);
      focusIssues();
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="identity-form" noValidate onSubmit={submit}>
      <ErrorSummary
        issues={issues}
        summaryOne={messages.errors.summaryOne}
        summaryMany={messages.errors.summaryMany}
      />
      <Field
        id="email"
        label={messages.auth.email}
        error={issueFor(issues, "email")}
      >
        <input name="email" type="email" autoComplete="email" />
      </Field>
      <SubmitButton
        label={messages.auth.sendResetLink}
        pendingLabel={messages.auth.sendingResetLink}
        isPending={pending}
      />
    </form>
  );
}

type ResetPasswordFormProps = AuthFormProps & Readonly<{ token: string }>;

export function ResetPasswordForm({
  locale,
  messages,
  token,
}: ResetPasswordFormProps) {
  const [issues, setIssues] = useState<readonly FormIssue[]>([]);
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);

  if (complete) {
    return (
      <AuthState
        state="success"
        title={messages.auth.resetSuccessTitle}
        body={messages.auth.resetSuccessBody}
        action={{ href: "/" + locale + "/login", label: messages.auth.signIn }}
      />
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = parseResetPassword(
      new FormData(event.currentTarget),
      messages,
    );
    if (!parsed.ok) {
      setIssues(parsed.issues);
      focusIssues();
      return;
    }

    setPending(true);
    setIssues([]);
    const { authClient } = await import("../infrastructure/auth-client");
    const result = await authClient.resetPassword({
      newPassword: parsed.value.password,
      token,
    });
    setPending(false);
    if (result.error) {
      setIssues([{ field: "password", message: messages.errors.generic }]);
      focusIssues();
      return;
    }
    setComplete(true);
  }

  return (
    <form className="identity-form" noValidate onSubmit={submit}>
      <ErrorSummary
        issues={issues}
        summaryOne={messages.errors.summaryOne}
        summaryMany={messages.errors.summaryMany}
      />
      <Field
        id="password"
        label={messages.auth.newPassword}
        description={messages.auth.passwordDescription}
        error={issueFor(issues, "password")}
      >
        <input name="password" type="password" autoComplete="new-password" />
      </Field>
      <Field
        id="confirmPassword"
        label={messages.auth.confirmPassword}
        error={issueFor(issues, "confirmPassword")}
      >
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
        />
      </Field>
      <SubmitButton
        label={messages.auth.resetPassword}
        pendingLabel={messages.auth.resettingPassword}
        isPending={pending}
      />
    </form>
  );
}

type VerificationActionsProps = AuthFormProps & Readonly<{ email: string }>;

export function VerificationActions({
  locale,
  messages,
  email,
}: VerificationActionsProps) {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  async function resend() {
    if (pending || !validEmail(email)) return;
    setPending(true);
    setSent(false);
    setFailed(false);
    try {
      const { authClient } = await import("../infrastructure/auth-client");
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: "/" + locale + "/continue",
      });
      if (result.error) throw new Error("Verification request failed");
      setSent(true);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="state-actions">
      <button
        className="button button-primary"
        type="button"
        disabled={pending}
        onClick={resend}
      >
        {messages.auth.resendVerification}
        {pending ? " · " + messages.auth.resendingVerification : ""}
      </button>
      {sent ? <p role="status">{messages.auth.verificationSentTitle}</p> : null}
      {failed ? <p role="alert">{messages.errors.generic}</p> : null}
      <Link
        className="button button-secondary"
        href={"/" + locale + "/register"}
      >
        {messages.auth.wrongAddress}
      </Link>
    </div>
  );
}
