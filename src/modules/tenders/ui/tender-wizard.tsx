"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import {
  ErrorSummary,
  SubmitButton,
  focusErrorSummary,
  type FormIssue,
} from "../../identity/ui/identity-form";
import { Field } from "../../identity/ui/field";
import { IdentityShell } from "../../identity/ui/identity-shell";
import type { CreateTenderDraftCommand } from "../application/create-tender-draft";
import type { SyncTenderLocationCommand } from "../application/sync-tender-location";
import type { UpdateTenderDraftCommand } from "../application/update-tender-draft";
import type { Coordinates } from "../domain/coordinates";

const MAX_ATTACHMENTS = 10;

type WizardStep = 0 | 1 | 2 | 3;
type LocationMode = "ADDRESS" | "PIN";

export type TenderWizardFormState = Readonly<{
  specialty?: "CONSTRUCTION_REPAIR";
  title?: string;
  shortDescription?: string;
  fullDescription?: string;
  scopeOfWork?: string;
  budget?: string;
  currency?: "GEL" | "USD";
  deadline?: string;
  desiredStartDate?: string;
  workerNotes?: string;
  equipmentNotes?: string;
  materialNotes?: string;
  conditions?: string;
  locationMode?: LocationMode;
  city?: string;
  district?: string;
  addressLine?: string;
  latitude?: string;
  longitude?: string;
  attachmentNames?: readonly string[];
}>;

export type TenderWizardApi = Readonly<{
  createDraft: (command: CreateTenderDraftCommand) => Promise<Response>;
  updateDraft: (
    tenderId: string,
    command: UpdateTenderDraftCommand,
  ) => Promise<Response>;
  syncLocation: (
    tenderId: string,
    command: SyncTenderLocationCommand,
  ) => Promise<Response>;
  uploadAttachment: (tenderId: string, file: File) => Promise<Response>;
  publishTender: (tenderId: string) => Promise<Response>;
}>;

const defaultApi: TenderWizardApi = {
  createDraft: (command) =>
    fetch("/api/tenders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command),
    }),
  updateDraft: (tenderId, command) =>
    fetch(`/api/tenders/${tenderId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command),
    }),
  syncLocation: (tenderId, command) =>
    fetch(`/api/tenders/${tenderId}/location`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command),
    }),
  uploadAttachment: (tenderId, file) => {
    const body = new FormData();
    body.set("file", file);
    return fetch(`/api/tenders/${tenderId}/attachments`, {
      method: "POST",
      body,
    });
  },
  publishTender: (tenderId) =>
    fetch(`/api/tenders/${tenderId}/publish`, { method: "POST" }),
};

const initialFormState: TenderWizardFormState = {
  specialty: "CONSTRUCTION_REPAIR",
  title: "",
  shortDescription: "",
  fullDescription: "",
  scopeOfWork: "",
  budget: "",
  currency: "GEL",
  deadline: "",
  desiredStartDate: "",
  workerNotes: "",
  equipmentNotes: "",
  materialNotes: "",
  conditions: "",
  locationMode: "ADDRESS",
  city: "",
  district: "",
  addressLine: "",
  latitude: "",
  longitude: "",
  attachmentNames: [],
};

const localCopy = {
  en: {
    specialty: "Construction & repair",
    latitude: "Latitude",
    longitude: "Longitude",
    attachmentCount: (count: number) => `${count} of ${MAX_ATTACHMENTS} files`,
  },
  ka: {
    specialty: "მშენებლობა და რემონტი",
    latitude: "განედი",
    longitude: "გრძედი",
    attachmentCount: (count: number) => `${count} / ${MAX_ATTACHMENTS} ფაილი`,
  },
} as const;

function trimmed(value: string | undefined) {
  return value?.trim() ?? "";
}

function isPositiveBudget(value: string | undefined) {
  if (!value) return false;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
}

function isCoordinate(
  value: string | undefined,
  minimum: number,
  maximum: number,
) {
  if (trimmed(value) === "") return false;
  const coordinate = Number(value);
  return (
    Number.isFinite(coordinate) &&
    coordinate >= minimum &&
    coordinate <= maximum
  );
}

export function validateWizardStep(
  step: number,
  form: TenderWizardFormState,
  messages: Messages,
): FormIssue[] {
  const issues: FormIssue[] = [];

  if (step === 0 && trimmed(form.title) === "") {
    issues.push({ field: "title", message: messages.errors.required });
  }

  if (step === 1) {
    if (trimmed(form.shortDescription) === "") {
      issues.push({
        field: "shortDescription",
        message: messages.tenders.errors.shortDescriptionRequired,
      });
    }
    if (trimmed(form.fullDescription) === "") {
      issues.push({
        field: "fullDescription",
        message: messages.tenders.errors.fullDescriptionRequired,
      });
    }
    if (trimmed(form.scopeOfWork) === "") {
      issues.push({
        field: "scopeOfWork",
        message: messages.tenders.errors.scopeRequired,
      });
    }
    if (!isPositiveBudget(form.budget) || !form.currency) {
      issues.push({
        field: "budget",
        message: messages.tenders.errors.budgetRequired,
      });
    }
    if (trimmed(form.deadline) === "") {
      issues.push({
        field: "deadline",
        message: messages.tenders.errors.deadlineRequired,
      });
    } else if (new Date(form.deadline ?? "").getTime() <= Date.now()) {
      issues.push({
        field: "deadline",
        message: messages.tenders.errors.deadlineNotFuture,
      });
    }
  }

  if (step === 2) {
    if (trimmed(form.city) === "") {
      issues.push({ field: "city", message: messages.errors.required });
    }
    if (form.locationMode === "PIN") {
      if (!isCoordinate(form.latitude, -90, 90)) {
        issues.push({ field: "latitude", message: messages.errors.required });
      }
      if (!isCoordinate(form.longitude, -180, 180)) {
        issues.push({ field: "longitude", message: messages.errors.required });
      }
    } else if (trimmed(form.addressLine) === "") {
      issues.push({ field: "addressLine", message: messages.errors.required });
    }
  }

  return issues;
}

export function onPinSelected(coordinates: Coordinates) {
  return {
    latitude: String(coordinates.latitude),
    longitude: String(coordinates.longitude),
  } as const;
}

function issueFor(issues: readonly FormIssue[], field: string) {
  return issues.find((issue) => issue.field === field)?.message;
}

function readErrorCode(value: unknown) {
  if (typeof value !== "object" || value === null || !("code" in value)) {
    return undefined;
  }
  return typeof value.code === "string" ? value.code : undefined;
}

function serverIssue(
  code: string | undefined,
  messages: Messages,
  fallbackField: string,
): FormIssue {
  const mapped: Readonly<Record<string, FormIssue>> = {
    TITLE_REQUIRED: {
      field: "title",
      message: messages.errors.required,
    },
    SHORT_DESCRIPTION_REQUIRED: {
      field: "shortDescription",
      message: messages.tenders.errors.shortDescriptionRequired,
    },
    FULL_DESCRIPTION_REQUIRED: {
      field: "fullDescription",
      message: messages.tenders.errors.fullDescriptionRequired,
    },
    SCOPE_REQUIRED: {
      field: "scopeOfWork",
      message: messages.tenders.errors.scopeRequired,
    },
    BUDGET_REQUIRED: {
      field: "budget",
      message: messages.tenders.errors.budgetRequired,
    },
    LOCATION_REQUIRED: {
      field: "city",
      message: messages.tenders.errors.locationRequired,
    },
    DEADLINE_REQUIRED: {
      field: "deadline",
      message: messages.tenders.errors.deadlineRequired,
    },
    DEADLINE_NOT_FUTURE: {
      field: "deadline",
      message: messages.tenders.errors.deadlineNotFuture,
    },
    INVALID_INPUT: {
      field: fallbackField,
      message: messages.tenders.errors.invalidInput,
    },
    TENDER_NOT_FOUND: {
      field: fallbackField,
      message: messages.tenders.errors.notFound,
    },
    NOT_OWNER: {
      field: fallbackField,
      message: messages.tenders.errors.notOwner,
    },
    NOT_DRAFT: {
      field: fallbackField,
      message: messages.tenders.errors.notDraft,
    },
    TOO_MANY_ATTACHMENTS: {
      field: "attachments",
      message: messages.tenders.errors.tooManyAttachments,
    },
    UNSUPPORTED_FILE_TYPE: {
      field: "attachments",
      message: messages.tenders.errors.unsupportedFileType,
    },
    FILE_TOO_LARGE: {
      field: "attachments",
      message: messages.tenders.errors.fileTooLarge,
    },
    ADDRESS_NOT_FOUND: {
      field: "addressLine",
      message: messages.tenders.errors.addressNotFound,
    },
    COORDINATES_NOT_FOUND: {
      field: "latitude",
      message: messages.tenders.errors.addressNotFound,
    },
  };

  return (
    (code ? mapped[code] : undefined) ?? {
      field: fallbackField,
      message: messages.errors.generic,
    }
  );
}

function stepForPublicationError(code: string | undefined): WizardStep {
  if (code === "TITLE_REQUIRED") return 0;
  if (code === "LOCATION_REQUIRED") return 2;
  if (
    code === "SHORT_DESCRIPTION_REQUIRED" ||
    code === "FULL_DESCRIPTION_REQUIRED" ||
    code === "SCOPE_REQUIRED" ||
    code === "BUDGET_REQUIRED" ||
    code === "DEADLINE_REQUIRED" ||
    code === "DEADLINE_NOT_FUTURE"
  ) {
    return 1;
  }
  return 3;
}

function toUpdateCommand(
  form: TenderWizardFormState,
): UpdateTenderDraftCommand {
  const command: UpdateTenderDraftCommand = {
    shortDescription: trimmed(form.shortDescription),
    fullDescription: trimmed(form.fullDescription),
    scopeOfWork: trimmed(form.scopeOfWork),
    budgetMinorUnits: Math.round(Number(form.budget) * 100),
    currency: form.currency ?? "GEL",
    deadline: new Date(form.deadline ?? ""),
    workerNotes: trimmed(form.workerNotes) || null,
    equipmentNotes: trimmed(form.equipmentNotes) || null,
    materialNotes: trimmed(form.materialNotes) || null,
    conditions: trimmed(form.conditions) || null,
  };
  const desiredStartDate = trimmed(form.desiredStartDate);
  return desiredStartDate
    ? { ...command, desiredStartDate: new Date(desiredStartDate) }
    : command;
}

function toLocationCommand(
  form: TenderWizardFormState,
): SyncTenderLocationCommand {
  const shared = {
    city: trimmed(form.city),
    district: trimmed(form.district) || null,
  };
  return form.locationMode === "PIN"
    ? {
        ...shared,
        mode: "PIN",
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
      }
    : {
        ...shared,
        mode: "ADDRESS",
        addressLine: trimmed(form.addressLine),
      };
}

function WizardRail({
  current,
  messages,
}: Readonly<{ current: WizardStep; messages: Messages }>) {
  const labels = [
    messages.tenders.wizardBasicsStep,
    messages.tenders.wizardScopeStep,
    messages.tenders.wizardLocationStep,
    messages.tenders.wizardReviewStep,
  ] as const;

  return (
    <ol className="wizard-rail" aria-label={`${current + 1} / 4`}>
      {labels.map((label, index) => (
        <li
          className={index <= current ? "is-complete" : ""}
          key={label}
          aria-current={index === current ? "step" : undefined}
        >
          <span>{index + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

function StepActions({
  canGoBack,
  isPending,
  messages,
  onBack,
}: Readonly<{
  canGoBack: boolean;
  isPending: boolean;
  messages: Messages;
  onBack: () => void;
}>) {
  return (
    <div className="wizard-actions">
      {canGoBack ? (
        <button
          className="button button-secondary"
          type="button"
          disabled={isPending}
          onClick={onBack}
        >
          {messages.common.back}
        </button>
      ) : null}
      <SubmitButton
        label={messages.common.continue}
        pendingLabel={messages.common.working}
        isPending={isPending}
      />
    </div>
  );
}

export function TenderWizard({
  locale,
  messages,
  api,
}: Readonly<{
  locale: Locale;
  messages: Messages;
  api?: Partial<TenderWizardApi>;
}>) {
  const tenderApi = { ...defaultApi, ...api };
  const copy = localCopy[locale];
  const [step, setStep] = useState<WizardStep>(0);
  const [form, setForm] = useState<TenderWizardFormState>(initialFormState);
  const [tenderId, setTenderId] = useState<string | null>(null);
  const [issues, setIssues] = useState<readonly FormIssue[]>([]);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/profile/me")
      .then(async (response) => {
        if (!response.ok) return;
        const result = (await response.json()) as {
          profile?: { preferredCurrency?: unknown };
        };
        const preferredCurrency = result.profile?.preferredCurrency;
        if (
          active &&
          (preferredCurrency === "GEL" || preferredCurrency === "USD")
        ) {
          setForm((current) => ({ ...current, currency: preferredCurrency }));
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  function updateField(field: keyof TenderWizardFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setIssues((current) => current.filter((issue) => issue.field !== field));
  }

  function showIssues(nextIssues: readonly FormIssue[]) {
    setIssues(nextIssues);
    queueMicrotask(() => focusErrorSummary());
  }

  async function parseResponse(response: Response) {
    return (await response.json().catch(() => ({}))) as unknown;
  }

  async function submitBasics(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const nextIssues = validateWizardStep(0, form, messages);
    if (nextIssues.length > 0) {
      showIssues(nextIssues);
      return;
    }

    setPending(true);
    setIssues([]);
    try {
      const response = tenderId
        ? await tenderApi.updateDraft(tenderId, { title: trimmed(form.title) })
        : await tenderApi.createDraft({
            specialty: "CONSTRUCTION_REPAIR",
            title: trimmed(form.title),
          });
      const result = await parseResponse(response);
      if (!response.ok) {
        showIssues([serverIssue(readErrorCode(result), messages, "title")]);
        return;
      }
      if (!tenderId) {
        const id =
          typeof result === "object" &&
          result !== null &&
          "tender" in result &&
          typeof result.tender === "object" &&
          result.tender !== null &&
          "id" in result.tender &&
          typeof result.tender.id === "string"
            ? result.tender.id
            : undefined;
        if (!id) {
          showIssues([serverIssue(undefined, messages, "title")]);
          return;
        }
        setTenderId(id);
      }
      setStep(1);
    } catch {
      showIssues([serverIssue(undefined, messages, "title")]);
    } finally {
      setPending(false);
    }
  }

  async function submitScope(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !tenderId) return;
    const nextIssues = validateWizardStep(1, form, messages);
    if (nextIssues.length > 0) {
      showIssues(nextIssues);
      return;
    }

    setPending(true);
    setIssues([]);
    try {
      const response = await tenderApi.updateDraft(
        tenderId,
        toUpdateCommand(form),
      );
      const result = await parseResponse(response);
      if (!response.ok) {
        showIssues([
          serverIssue(readErrorCode(result), messages, "shortDescription"),
        ]);
        return;
      }
      setStep(2);
    } catch {
      showIssues([serverIssue(undefined, messages, "shortDescription")]);
    } finally {
      setPending(false);
    }
  }

  async function submitLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || uploading || !tenderId) return;
    const nextIssues = validateWizardStep(2, form, messages);
    if (nextIssues.length > 0) {
      showIssues(nextIssues);
      return;
    }

    setPending(true);
    setIssues([]);
    try {
      const response = await tenderApi.syncLocation(
        tenderId,
        toLocationCommand(form),
      );
      const result = await parseResponse(response);
      if (!response.ok) {
        showIssues([
          serverIssue(
            readErrorCode(result),
            messages,
            form.locationMode === "PIN" ? "latitude" : "addressLine",
          ),
        ]);
        return;
      }
      setStep(3);
    } catch {
      showIssues([serverIssue(undefined, messages, "city")]);
    } finally {
      setPending(false);
    }
  }

  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const selectedFiles = Array.from(input.files ?? []);
    if (!tenderId || selectedFiles.length === 0 || uploading) return;
    const existingCount = form.attachmentNames?.length ?? 0;
    if (existingCount + selectedFiles.length > MAX_ATTACHMENTS) {
      showIssues([
        serverIssue("TOO_MANY_ATTACHMENTS", messages, "attachments"),
      ]);
      input.value = "";
      return;
    }

    setUploading(true);
    setIssues((current) =>
      current.filter((issue) => issue.field !== "attachments"),
    );
    try {
      for (const file of selectedFiles) {
        const response = await tenderApi.uploadAttachment(tenderId, file);
        const result = await parseResponse(response);
        if (!response.ok) {
          showIssues([
            serverIssue(readErrorCode(result), messages, "attachments"),
          ]);
          return;
        }
        setForm((current) => ({
          ...current,
          attachmentNames: [...(current.attachmentNames ?? []), file.name],
        }));
      }
    } catch {
      showIssues([serverIssue(undefined, messages, "attachments")]);
    } finally {
      setUploading(false);
      input.value = "";
    }
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !tenderId) return;
    setPending(true);
    setIssues([]);
    try {
      const response = await tenderApi.publishTender(tenderId);
      const result = await parseResponse(response);
      if (!response.ok) {
        const code = readErrorCode(result);
        setStep(stepForPublicationError(code));
        showIssues([serverIssue(code, messages, "publish")]);
        return;
      }
      window.location.assign(`/${locale}/client/tenders/${tenderId}`);
    } catch {
      showIssues([serverIssue(undefined, messages, "publish")]);
    } finally {
      setPending(false);
    }
  }

  const attachmentNames = form.attachmentNames ?? [];

  return (
    <IdentityShell title={messages.tenders.newTender}>
      <WizardRail current={step} messages={messages} />
      {step === 0 ? (
        <form className="identity-form" noValidate onSubmit={submitBasics}>
          <h2 className="wizard-step-title">
            {messages.tenders.wizardBasicsStep}
          </h2>
          <ErrorSummary
            issues={issues}
            summaryOne={messages.errors.summaryOne}
            summaryMany={messages.errors.summaryMany}
          />
          <Field
            id="specialty"
            label={messages.tenders.filterSpecialty}
            description={messages.auth.constructionSpecialty}
          >
            <input
              name="specialty"
              type="text"
              value={copy.specialty}
              readOnly
            />
          </Field>
          <Field
            id="title"
            label={messages.tenders.title}
            error={issueFor(issues, "title")}
          >
            <input
              name="title"
              type="text"
              maxLength={160}
              autoComplete="off"
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
            />
          </Field>
          <StepActions
            canGoBack={false}
            isPending={pending}
            messages={messages}
            onBack={() => undefined}
          />
        </form>
      ) : null}

      {step === 1 ? (
        <form className="identity-form" noValidate onSubmit={submitScope}>
          <h2 className="wizard-step-title">
            {messages.tenders.wizardScopeStep}
          </h2>
          <ErrorSummary
            issues={issues}
            summaryOne={messages.errors.summaryOne}
            summaryMany={messages.errors.summaryMany}
          />
          <Field
            id="shortDescription"
            label={messages.tenders.shortDescription}
            error={issueFor(issues, "shortDescription")}
          >
            <textarea
              name="shortDescription"
              maxLength={240}
              value={form.shortDescription}
              onChange={(event) =>
                updateField("shortDescription", event.target.value)
              }
            />
          </Field>
          <Field
            id="fullDescription"
            label={messages.tenders.fullDescription}
            error={issueFor(issues, "fullDescription")}
          >
            <textarea
              name="fullDescription"
              maxLength={5000}
              value={form.fullDescription}
              onChange={(event) =>
                updateField("fullDescription", event.target.value)
              }
            />
          </Field>
          <Field
            id="scopeOfWork"
            label={messages.tenders.scopeOfWork}
            error={issueFor(issues, "scopeOfWork")}
          >
            <textarea
              name="scopeOfWork"
              maxLength={2000}
              value={form.scopeOfWork}
              onChange={(event) =>
                updateField("scopeOfWork", event.target.value)
              }
            />
          </Field>
          <div className="wizard-paired-fields">
            <Field
              id="budget"
              label={messages.tenders.budget}
              error={issueFor(issues, "budget")}
            >
              <input
                name="budget"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={form.budget}
                onChange={(event) => updateField("budget", event.target.value)}
              />
            </Field>
            <Field id="currency" label={messages.tenders.currency}>
              <select
                name="currency"
                value={form.currency}
                onChange={(event) =>
                  updateField("currency", event.target.value)
                }
              >
                <option value="GEL">GEL</option>
                <option value="USD">USD</option>
              </select>
            </Field>
          </div>
          <Field
            id="deadline"
            label={messages.tenders.deadline}
            error={issueFor(issues, "deadline")}
          >
            <input
              name="deadline"
              type="datetime-local"
              value={form.deadline}
              onChange={(event) => updateField("deadline", event.target.value)}
            />
          </Field>
          <Field
            id="desiredStartDate"
            label={messages.tenders.desiredStartDate}
            description={messages.common.optional}
          >
            <input
              name="desiredStartDate"
              type="date"
              value={form.desiredStartDate}
              onChange={(event) =>
                updateField("desiredStartDate", event.target.value)
              }
            />
          </Field>
          {(
            [
              ["workerNotes", messages.tenders.workerNotes, 1000],
              ["equipmentNotes", messages.tenders.equipmentNotes, 1000],
              ["materialNotes", messages.tenders.materialNotes, 1000],
              ["conditions", messages.tenders.conditions, 2000],
            ] as const
          ).map(([field, label, maxLength]) => (
            <Field
              id={field}
              label={label}
              description={messages.common.optional}
              key={field}
            >
              <textarea
                name={field}
                maxLength={maxLength}
                value={form[field]}
                onChange={(event) => updateField(field, event.target.value)}
              />
            </Field>
          ))}
          <StepActions
            canGoBack
            isPending={pending}
            messages={messages}
            onBack={() => {
              setIssues([]);
              setStep(0);
            }}
          />
        </form>
      ) : null}

      {step === 2 ? (
        <form className="identity-form" noValidate onSubmit={submitLocation}>
          <h2 className="wizard-step-title">
            {messages.tenders.wizardLocationStep}
          </h2>
          <ErrorSummary
            issues={issues}
            summaryOne={messages.errors.summaryOne}
            summaryMany={messages.errors.summaryMany}
          />
          <Field
            id="city"
            label={messages.tenders.city}
            error={issueFor(issues, "city")}
          >
            <input
              name="city"
              type="text"
              autoComplete="address-level2"
              maxLength={120}
              value={form.city}
              onChange={(event) => updateField("city", event.target.value)}
            />
          </Field>
          <Field
            id="district"
            label={messages.tenders.district}
            description={messages.common.optional}
          >
            <input
              name="district"
              type="text"
              autoComplete="address-level3"
              maxLength={120}
              value={form.district}
              onChange={(event) => updateField("district", event.target.value)}
            />
          </Field>
          <label className="checkbox-field wizard-location-toggle">
            <input
              name="chooseOnMap"
              type="checkbox"
              checked={form.locationMode === "PIN"}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  locationMode: event.target.checked ? "PIN" : "ADDRESS",
                }));
                setIssues([]);
              }}
            />
            <span>{messages.tenders.chooseOnMap}</span>
          </label>
          {form.locationMode === "PIN" ? (
            <div className="wizard-paired-fields">
              <Field
                id="latitude"
                label={copy.latitude}
                error={issueFor(issues, "latitude")}
              >
                <input
                  name="latitude"
                  type="number"
                  min="-90"
                  max="90"
                  step="any"
                  inputMode="decimal"
                  value={form.latitude}
                  onChange={(event) =>
                    updateField("latitude", event.target.value)
                  }
                />
              </Field>
              <Field
                id="longitude"
                label={copy.longitude}
                error={issueFor(issues, "longitude")}
              >
                <input
                  name="longitude"
                  type="number"
                  min="-180"
                  max="180"
                  step="any"
                  inputMode="decimal"
                  value={form.longitude}
                  onChange={(event) =>
                    updateField("longitude", event.target.value)
                  }
                />
              </Field>
            </div>
          ) : (
            <Field
              id="addressLine"
              label={messages.tenders.addressLine}
              error={issueFor(issues, "addressLine")}
            >
              <input
                name="addressLine"
                type="text"
                autoComplete="street-address"
                maxLength={240}
                value={form.addressLine}
                onChange={(event) =>
                  updateField("addressLine", event.target.value)
                }
              />
            </Field>
          )}
          <Field
            id="attachments"
            label={messages.tenders.uploadAttachment}
            description={messages.tenders.attachmentHint}
            error={issueFor(issues, "attachments")}
            suffix={
              <span className="attachment-count" aria-live="polite">
                {copy.attachmentCount(attachmentNames.length)}
              </span>
            }
          >
            <input
              name="attachments"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              multiple
              disabled={uploading || attachmentNames.length >= MAX_ATTACHMENTS}
              onChange={uploadFiles}
            />
          </Field>
          {attachmentNames.length > 0 ? (
            <ul
              className="attachment-list"
              aria-label={messages.tenders.attachments}
            >
              {attachmentNames.map((name, index) => (
                <li key={`${name}:${index}`}>{name}</li>
              ))}
            </ul>
          ) : null}
          <StepActions
            canGoBack
            isPending={pending || uploading}
            messages={messages}
            onBack={() => {
              setIssues([]);
              setStep(1);
            }}
          />
        </form>
      ) : null}

      {step === 3 ? (
        <form className="identity-form" noValidate onSubmit={publish}>
          <h2 className="wizard-step-title" id="publish">
            {messages.tenders.wizardReviewStep}
          </h2>
          <ErrorSummary
            issues={issues}
            summaryOne={messages.errors.summaryOne}
            summaryMany={messages.errors.summaryMany}
          />
          <dl className="wizard-review">
            {[
              [messages.tenders.filterSpecialty, copy.specialty],
              [messages.tenders.title, form.title],
              [messages.tenders.shortDescription, form.shortDescription],
              [messages.tenders.fullDescription, form.fullDescription],
              [messages.tenders.scopeOfWork, form.scopeOfWork],
              [
                messages.tenders.budget,
                `${form.budget ?? ""} ${form.currency ?? ""}`,
              ],
              [messages.tenders.deadline, form.deadline],
              [messages.tenders.desiredStartDate, form.desiredStartDate],
              [messages.tenders.workerNotes, form.workerNotes],
              [messages.tenders.equipmentNotes, form.equipmentNotes],
              [messages.tenders.materialNotes, form.materialNotes],
              [messages.tenders.conditions, form.conditions],
              [messages.tenders.city, form.city],
              [messages.tenders.district, form.district],
              [
                form.locationMode === "PIN"
                  ? messages.tenders.chooseOnMap
                  : messages.tenders.addressLine,
                form.locationMode === "PIN"
                  ? `${form.latitude ?? ""}, ${form.longitude ?? ""}`
                  : form.addressLine,
              ],
              [messages.tenders.attachments, attachmentNames.join(", ")],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{trimmed(value) || messages.common.optional}</dd>
              </div>
            ))}
          </dl>
          <div className="wizard-actions">
            <button
              className="button button-secondary"
              type="button"
              disabled={pending}
              onClick={() => {
                setIssues([]);
                setStep(2);
              }}
            >
              {messages.common.back}
            </button>
            <SubmitButton
              label={messages.tenders.publish}
              pendingLabel={messages.tenders.publishing}
              isPending={pending}
            />
          </div>
        </form>
      ) : null}
    </IdentityShell>
  );
}
