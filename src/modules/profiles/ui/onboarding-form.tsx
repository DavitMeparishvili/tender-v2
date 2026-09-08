"use client";

import { useState, type FormEvent } from "react";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import {
  ErrorSummary,
  SubmitButton,
  focusErrorSummary,
  type FormIssue,
} from "../../identity/ui/identity-form";
import { Field } from "../../identity/ui/field";
import type { CompleteOnboardingCommand } from "../application/complete-onboarding";

type OnboardingIntent = "CLIENT" | "CONSTRUCTION_PROVIDER";

function value(form: FormData, key: string): string {
  const entry = form.get(key);
  return typeof entry === "string" ? entry : "";
}

export function serializeOnboarding(
  form: FormData,
  intent: OnboardingIntent,
  locale: Locale,
): CompleteOnboardingCommand {
  return {
    intent,
    accountKind:
      value(form, "accountKind") === "COMPANY" ? "COMPANY" : "PERSON",
    displayName: value(form, "displayName").trim(),
    phoneE164: value(form, "phoneE164").replace(/[\s()-]/g, ""),
    countryCode: "GE",
    city: value(form, "city").trim(),
    activityDescription: value(form, "activityDescription").trim(),
    preferredLocale: locale,
    preferredCurrency:
      value(form, "preferredCurrency") === "USD" ? "USD" : "GEL",
  };
}

function validate(
  command: CompleteOnboardingCommand,
  messages: Messages,
): readonly FormIssue[] {
  const issues: FormIssue[] = [];
  if (command.displayName.length < 2 || command.displayName.length > 120) {
    issues.push({
      field: "displayName",
      message: messages.errors.nameLength,
    });
  }
  if (!/^\+[1-9]\d{7,14}$/.test(command.phoneE164)) {
    issues.push({ field: "phoneE164", message: messages.errors.invalidPhone });
  }
  if (command.city.length < 2 || command.city.length > 120) {
    issues.push({ field: "city", message: messages.errors.nameLength });
  }
  if (
    command.activityDescription.length < 2 ||
    command.activityDescription.length > 2000
  ) {
    issues.push({
      field: "activityDescription",
      message: messages.errors.invalidInput,
    });
  }
  return issues;
}

function issueFor(issues: readonly FormIssue[], field: string) {
  return issues.find((issue) => issue.field === field)?.message;
}

type OnboardingFormProps = Readonly<{
  intent: OnboardingIntent;
  locale: Locale;
  messages: Messages;
}>;

export function OnboardingForm({
  intent,
  locale,
  messages,
}: OnboardingFormProps) {
  const [issues, setIssues] = useState<readonly FormIssue[]>([]);
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const command = serializeOnboarding(
      new FormData(event.currentTarget),
      intent,
      locale,
    );
    const nextIssues = validate(command, messages);
    if (nextIssues.length > 0) {
      setIssues(nextIssues);
      queueMicrotask(() => focusErrorSummary());
      return;
    }

    setPending(true);
    setIssues([]);
    try {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(command),
      });
      const result = (await response.json().catch(() => ({}))) as {
        code?: unknown;
      };
      if (!response.ok) {
        setPending(false);
        const field =
          result.code === "PHONE_CONFLICT" ? "phoneE164" : "displayName";
        const message =
          result.code === "PHONE_CONFLICT"
            ? messages.errors.phoneConflict
            : result.code === "EMAIL_UNVERIFIED"
              ? messages.errors.emailUnverified
              : messages.errors.invalidInput;
        setIssues([{ field, message }]);
        queueMicrotask(() => focusErrorSummary());
        return;
      }

      setDirty(false);
      window.location.assign(
        "/" + locale + (intent === "CLIENT" ? "/client" : "/provider"),
      );
    } catch {
      setPending(false);
      setIssues([{ field: "displayName", message: messages.errors.generic }]);
      queueMicrotask(() => focusErrorSummary());
    }
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
        id="accountKind"
        label={messages.onboarding.accountKind}
        error={issueFor(issues, "accountKind")}
      >
        <select name="accountKind" defaultValue="PERSON">
          <option value="PERSON">{messages.onboarding.person}</option>
          <option value="COMPANY">{messages.onboarding.company}</option>
        </select>
      </Field>
      <Field
        id="displayName"
        label={messages.onboarding.displayName}
        error={issueFor(issues, "displayName")}
      >
        <input name="displayName" type="text" autoComplete="name" />
      </Field>
      <Field
        id="phoneE164"
        label={messages.onboarding.phone}
        description={messages.onboarding.phoneDescription}
        error={issueFor(issues, "phoneE164")}
      >
        <input name="phoneE164" type="tel" autoComplete="tel" inputMode="tel" />
      </Field>
      <Field id="country" label={messages.onboarding.country}>
        <input value={messages.onboarding.georgia} readOnly />
      </Field>
      <Field
        id="city"
        label={messages.onboarding.city}
        error={issueFor(issues, "city")}
      >
        <input name="city" type="text" autoComplete="address-level2" />
      </Field>
      <Field
        id="activityDescription"
        label={messages.onboarding.activity}
        description={
          intent === "CLIENT"
            ? messages.onboarding.activityClientDescription
            : messages.onboarding.activityProviderDescription
        }
        error={issueFor(issues, "activityDescription")}
      >
        <textarea name="activityDescription" />
      </Field>
      <Field id="preferredCurrency" label={messages.onboarding.currency}>
        <select name="preferredCurrency" defaultValue="GEL">
          <option value="GEL">GEL</option>
          <option value="USD">USD</option>
        </select>
      </Field>
      <SubmitButton
        label={messages.onboarding.complete}
        pendingLabel={messages.onboarding.completing}
        isPending={pending}
      />
    </form>
  );
}
