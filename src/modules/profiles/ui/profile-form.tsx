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
import type { SafeProfileView } from "../application/complete-onboarding";
import type { UpdateOwnProfileCommand } from "../application/update-own-profile";

function value(form: FormData, key: string): string {
  const entry = form.get(key);
  return typeof entry === "string" ? entry : "";
}

export function serializeProfileUpdate(
  form: FormData,
  currentPhotoObjectKey: string | null,
): UpdateOwnProfileCommand {
  return {
    displayName: value(form, "displayName").trim(),
    phoneE164: value(form, "phoneE164").replace(/[\s()-]/g, ""),
    city: value(form, "city").trim(),
    activityDescription: value(form, "activityDescription").trim(),
    preferredLocale: value(form, "preferredLocale") === "en" ? "en" : "ka",
    preferredCurrency:
      value(form, "preferredCurrency") === "USD" ? "USD" : "GEL",
    profilePhotoObjectKey:
      form.get("removePhoto") === "on" ? null : currentPhotoObjectKey,
  };
}

function validate(
  command: UpdateOwnProfileCommand,
  messages: Messages,
): readonly FormIssue[] {
  const issues: FormIssue[] = [];
  if (!command.displayName || command.displayName.length < 2) {
    issues.push({
      field: "displayName",
      message: messages.errors.nameLength,
    });
  }
  if (!command.phoneE164 || !/^\+[1-9]\d{7,14}$/.test(command.phoneE164)) {
    issues.push({ field: "phoneE164", message: messages.errors.invalidPhone });
  }
  if (!command.city || command.city.length < 2) {
    issues.push({ field: "city", message: messages.errors.nameLength });
  }
  if (!command.activityDescription || command.activityDescription.length < 2) {
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

type ProfileFormProps = Readonly<{
  locale: Locale;
  profile: SafeProfileView;
  messages: Messages;
}>;

export function ProfileForm({ locale, profile, messages }: ProfileFormProps) {
  const [current, setCurrent] = useState(profile);
  const [issues, setIssues] = useState<readonly FormIssue[]>([]);
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const command = serializeProfileUpdate(
      new FormData(event.currentTarget),
      current.profilePhotoObjectKey,
    );
    const nextIssues = validate(command, messages);
    if (nextIssues.length > 0) {
      setIssues(nextIssues);
      queueMicrotask(() => focusErrorSummary());
      return;
    }

    setPending(true);
    setSaved(false);
    setIssues([]);
    const response = await fetch("/api/profile/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command),
    });
    const result = (await response.json().catch(() => ({}))) as {
      code?: unknown;
      profile?: SafeProfileView;
    };
    setPending(false);
    if (!response.ok || result.profile === undefined) {
      setIssues([
        {
          field: result.code === "PHONE_CONFLICT" ? "phoneE164" : "displayName",
          message:
            result.code === "PHONE_CONFLICT"
              ? messages.errors.phoneConflict
              : messages.errors.invalidInput,
        },
      ]);
      queueMicrotask(() => focusErrorSummary());
      return;
    }

    setCurrent(result.profile);
    setDirty(false);
    setSaved(true);
    if (result.profile.preferredLocale !== locale) {
      window.location.assign("/" + result.profile.preferredLocale + "/profile");
    }
  }

  return (
    <form
      className="identity-form"
      data-dirty={dirty ? "true" : "false"}
      noValidate
      onInput={() => {
        setDirty(true);
        setSaved(false);
      }}
      onSubmit={submit}
    >
      {saved ? (
        <p className="success-status" role="status">
          {messages.profile.saved}
        </p>
      ) : null}
      <ErrorSummary
        issues={issues}
        summaryOne={messages.errors.summaryOne}
        summaryMany={messages.errors.summaryMany}
      />
      <Field
        id="displayName"
        label={messages.onboarding.displayName}
        error={issueFor(issues, "displayName")}
      >
        <input
          name="displayName"
          type="text"
          autoComplete="name"
          defaultValue={current.displayName}
        />
      </Field>
      <Field
        id="phoneE164"
        label={messages.onboarding.phone}
        description={messages.profile.phoneVerificationReset}
        error={issueFor(issues, "phoneE164")}
      >
        <input
          name="phoneE164"
          type="tel"
          autoComplete="tel"
          defaultValue={current.phoneE164}
        />
      </Field>
      <Field
        id="city"
        label={messages.onboarding.city}
        error={issueFor(issues, "city")}
      >
        <input
          name="city"
          type="text"
          autoComplete="address-level2"
          defaultValue={current.city}
        />
      </Field>
      <Field
        id="activityDescription"
        label={messages.onboarding.activity}
        error={issueFor(issues, "activityDescription")}
      >
        <textarea
          name="activityDescription"
          defaultValue={current.activityDescription}
        />
      </Field>
      <Field id="preferredLocale" label={messages.onboarding.locale}>
        <select name="preferredLocale" defaultValue={current.preferredLocale}>
          <option value="ka">{messages.common.georgian}</option>
          <option value="en">{messages.common.english}</option>
        </select>
      </Field>
      <Field id="preferredCurrency" label={messages.onboarding.currency}>
        <select
          name="preferredCurrency"
          defaultValue={current.preferredCurrency}
        >
          <option value="GEL">GEL</option>
          <option value="USD">USD</option>
        </select>
      </Field>
      {current.profilePhotoObjectKey ? (
        <label className="checkbox-field">
          <input name="removePhoto" type="checkbox" />
          <span>
            {messages.profile.removePhoto}
            <small>{messages.profile.photoDescription}</small>
          </span>
        </label>
      ) : null}
      <SubmitButton
        label={messages.common.save}
        pendingLabel={messages.common.saving}
        isPending={pending}
      />
    </form>
  );
}
