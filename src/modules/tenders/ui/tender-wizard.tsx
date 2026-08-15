"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
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
import {
  parseDateInputValue,
  parseGeorgiaDateTimeLocal,
} from "./georgia-date-time";

const MAX_ATTACHMENTS = 10;
const MAX_PRISMA_INT = BigInt(2_147_483_647);

type WizardStep = 0 | 1 | 2 | 3;
type LocationMode = "ADDRESS" | "PIN";
type FocusRequest = "heading" | "errors" | null;

function stepHeadingId(step: WizardStep) {
  return `wizard-step-${step + 1}-heading`;
}

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

function trimmed(value: string | undefined) {
  return value?.trim() ?? "";
}

export function majorUnitsToMinor(value: string | undefined): number | null {
  const match = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(trimmed(value));
  if (!match) return null;
  const major = BigInt(match[1] ?? "0");
  const fraction = BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  const minor = major * BigInt(100) + fraction;
  if (minor <= BigInt(0) || minor > MAX_PRISMA_INT) return null;
  return Number(minor);
}

export function wizardHasUnsavedWork(
  tenderId: string | null,
  modified: boolean,
) {
  return tenderId !== null || modified;
}

export function shouldGuardWizardLink(
  currentHref: string,
  destinationHref: string,
) {
  try {
    const current = new URL(currentHref);
    const destination = new URL(destinationHref, current);
    return (
      destination.origin !== current.origin ||
      destination.pathname !== current.pathname ||
      destination.search !== current.search
    );
  } catch {
    return true;
  }
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

  if (step === 0) {
    const title = trimmed(form.title);
    if (title === "") {
      issues.push({ field: "title", message: messages.errors.required });
    } else if (title.length < 5) {
      issues.push({
        field: "title",
        message: messages.tenders.errors.invalidInput,
      });
    }
  }

  if (step === 1) {
    const shortDescription = trimmed(form.shortDescription);
    const fullDescription = trimmed(form.fullDescription);
    const scopeOfWork = trimmed(form.scopeOfWork);
    if (shortDescription === "") {
      issues.push({
        field: "shortDescription",
        message: messages.tenders.errors.shortDescriptionRequired,
      });
    } else if (shortDescription.length < 10) {
      issues.push({
        field: "shortDescription",
        message: messages.tenders.errors.invalidInput,
      });
    }
    if (fullDescription === "") {
      issues.push({
        field: "fullDescription",
        message: messages.tenders.errors.fullDescriptionRequired,
      });
    } else if (fullDescription.length < 20) {
      issues.push({
        field: "fullDescription",
        message: messages.tenders.errors.invalidInput,
      });
    }
    if (scopeOfWork === "") {
      issues.push({
        field: "scopeOfWork",
        message: messages.tenders.errors.scopeRequired,
      });
    } else if (scopeOfWork.length < 10) {
      issues.push({
        field: "scopeOfWork",
        message: messages.tenders.errors.invalidInput,
      });
    }
    if (trimmed(form.budget) === "" || !form.currency) {
      issues.push({
        field: "budget",
        message: messages.tenders.errors.budgetRequired,
      });
    } else if (majorUnitsToMinor(form.budget) === null) {
      issues.push({
        field: "budget",
        message: messages.tenders.errors.invalidInput,
      });
    }
    if (trimmed(form.deadline) === "") {
      issues.push({
        field: "deadline",
        message: messages.tenders.errors.deadlineRequired,
      });
    } else {
      const deadline = parseGeorgiaDateTimeLocal(form.deadline ?? "");
      if (deadline === null) {
        issues.push({
          field: "deadline",
          message: messages.tenders.errors.invalidInput,
        });
      } else if (deadline.getTime() <= Date.now()) {
        issues.push({
          field: "deadline",
          message: messages.tenders.errors.deadlineNotFuture,
        });
      }
    }
    const desiredStartDate = trimmed(form.desiredStartDate);
    if (
      desiredStartDate !== "" &&
      parseDateInputValue(desiredStartDate) === null
    ) {
      issues.push({
        field: "desiredStartDate",
        message: messages.tenders.errors.invalidInput,
      });
    }
  }

  if (step === 2) {
    const city = trimmed(form.city);
    if (city === "") {
      issues.push({ field: "city", message: messages.errors.required });
    } else if (city.length < 2) {
      issues.push({
        field: "city",
        message: messages.tenders.errors.invalidInput,
      });
    }
    if (form.locationMode === "PIN") {
      if (!isCoordinate(form.latitude, -90, 90)) {
        issues.push({ field: "latitude", message: messages.errors.required });
      }
      if (!isCoordinate(form.longitude, -180, 180)) {
        issues.push({ field: "longitude", message: messages.errors.required });
      }
    } else {
      const addressLine = trimmed(form.addressLine);
      if (addressLine === "") {
        issues.push({
          field: "addressLine",
          message: messages.errors.required,
        });
      } else if (addressLine.length < 3) {
        issues.push({
          field: "addressLine",
          message: messages.tenders.errors.invalidInput,
        });
      }
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

export function toUpdateCommand(
  form: TenderWizardFormState,
): UpdateTenderDraftCommand {
  const budgetMinorUnits = majorUnitsToMinor(form.budget);
  if (budgetMinorUnits === null) {
    throw new RangeError("Budget must be validated before serialization.");
  }
  const deadline = parseGeorgiaDateTimeLocal(form.deadline ?? "");
  if (deadline === null) {
    throw new RangeError("Deadline must be validated before serialization.");
  }
  const desiredStartDateValue = trimmed(form.desiredStartDate);
  const desiredStartDate = desiredStartDateValue
    ? parseDateInputValue(desiredStartDateValue)
    : null;
  if (desiredStartDateValue && desiredStartDate === null) {
    throw new RangeError(
      "Desired start date must be validated before serialization.",
    );
  }
  const command: UpdateTenderDraftCommand = {
    shortDescription: trimmed(form.shortDescription),
    fullDescription: trimmed(form.fullDescription),
    scopeOfWork: trimmed(form.scopeOfWork),
    budgetMinorUnits,
    currency: form.currency ?? "GEL",
    deadline,
    desiredStartDate,
    workerNotes: trimmed(form.workerNotes) || null,
    equipmentNotes: trimmed(form.equipmentNotes) || null,
    materialNotes: trimmed(form.materialNotes) || null,
    conditions: trimmed(form.conditions) || null,
  };
  return command;
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
  initialForm,
  initialTenderId,
}: Readonly<{
  locale: Locale;
  messages: Messages;
  api?: Partial<TenderWizardApi>;
  initialForm?: TenderWizardFormState;
  initialTenderId?: string;
}>) {
  const tenderApi = { ...defaultApi, ...api };
  const [step, setStep] = useState<WizardStep>(0);
  const [form, setForm] = useState<TenderWizardFormState>(() => ({
    ...initialFormState,
    ...initialForm,
  }));
  const [tenderId, setTenderId] = useState<string | null>(
    initialTenderId ?? null,
  );
  const [issues, setIssues] = useState<readonly FormIssue[]>([]);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [modified, setModified] = useState(false);
  const focusRequest = useRef<FocusRequest>(null);
  const currencyTouched = useRef(initialForm?.currency !== undefined);
  const allowNavigation = useRef(false);
  const hasUnsavedWork = wizardHasUnsavedWork(tenderId, modified);

  useEffect(() => {
    const request = focusRequest.current;
    if (request === null) return;
    focusRequest.current = null;
    if (request === "errors") {
      focusErrorSummary();
      return;
    }
    document.getElementById(stepHeadingId(step))?.focus();
  }, [issues, step]);

  useEffect(() => {
    if (!hasUnsavedWork) return;
    const dirtyWarning = messages.tenders.dirtyWarning;
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (allowNavigation.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    function warnBeforeLinkNavigation(event: MouseEvent) {
      if (allowNavigation.current || event.defaultPrevented) return;
      const target = event.target;
      const anchor =
        target instanceof Element
          ? target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (
        anchor === null ||
        anchor.classList.contains("locale-link") ||
        anchor.target === "_blank" ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      if (!shouldGuardWizardLink(window.location.href, anchor.href)) return;
      if (!window.confirm(dirtyWarning)) {
        event.preventDefault();
      }
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("click", warnBeforeLinkNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.removeEventListener("click", warnBeforeLinkNavigation, true);
    };
  }, [hasUnsavedWork, messages.tenders.dirtyWarning]);

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
          !currencyTouched.current &&
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
    setModified(true);
  }

  function showIssues(nextIssues: readonly FormIssue[]) {
    focusRequest.current = "errors";
    setIssues(nextIssues);
  }

  function moveToStep(nextStep: WizardStep) {
    focusRequest.current = "heading";
    setIssues([]);
    setStep(nextStep);
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
      moveToStep(1);
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
      moveToStep(2);
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
      moveToStep(3);
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
        showIssues([
          serverIssue(
            code,
            messages,
            stepHeadingId(stepForPublicationError(code)),
          ),
        ]);
        return;
      }
      allowNavigation.current = true;
      window.location.assign(`/${locale}/client/tenders/${tenderId}`);
    } catch {
      showIssues([serverIssue(undefined, messages, stepHeadingId(3))]);
    } finally {
      setPending(false);
    }
  }

  const attachmentNames = form.attachmentNames ?? [];

  return (
    <IdentityShell title={messages.tenders.newTender}>
      <WizardRail current={step} messages={messages} />
      {step === 0 ? (
        <form
          className="identity-form"
          data-dirty={hasUnsavedWork ? "true" : "false"}
          aria-labelledby={stepHeadingId(0)}
          noValidate
          onSubmit={submitBasics}
        >
          <h2 className="wizard-step-title" id={stepHeadingId(0)} tabIndex={-1}>
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
            description={messages.tenders.specialtyConstructionRepairHint}
          >
            <input
              name="specialty"
              type="text"
              value={messages.tenders.specialtyConstructionRepair}
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
              minLength={5}
              maxLength={160}
              required
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
        <form
          className="identity-form"
          data-dirty={hasUnsavedWork ? "true" : "false"}
          aria-labelledby={stepHeadingId(1)}
          noValidate
          onSubmit={submitScope}
        >
          <h2 className="wizard-step-title" id={stepHeadingId(1)} tabIndex={-1}>
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
              minLength={10}
              maxLength={240}
              required
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
              minLength={20}
              maxLength={5000}
              required
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
              minLength={10}
              maxLength={2000}
              required
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
                max="21474836.47"
                step="0.01"
                inputMode="decimal"
                required
                value={form.budget}
                onChange={(event) => updateField("budget", event.target.value)}
              />
            </Field>
            <Field id="currency" label={messages.tenders.currency}>
              <select
                name="currency"
                value={form.currency}
                onChange={(event) => {
                  currencyTouched.current = true;
                  updateField("currency", event.target.value);
                }}
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
              required
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
            onBack={() => moveToStep(0)}
          />
        </form>
      ) : null}

      {step === 2 ? (
        <form
          className="identity-form"
          data-dirty={hasUnsavedWork ? "true" : "false"}
          aria-labelledby={stepHeadingId(2)}
          noValidate
          onSubmit={submitLocation}
        >
          <h2 className="wizard-step-title" id={stepHeadingId(2)} tabIndex={-1}>
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
              minLength={2}
              maxLength={120}
              required
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
                setModified(true);
              }}
            />
            <span>{messages.tenders.chooseOnMap}</span>
          </label>
          {form.locationMode === "PIN" ? (
            <div className="wizard-paired-fields">
              <Field
                id="latitude"
                label={messages.tenders.latitude}
                error={issueFor(issues, "latitude")}
              >
                <input
                  name="latitude"
                  type="number"
                  min="-90"
                  max="90"
                  step="any"
                  inputMode="decimal"
                  required
                  value={form.latitude}
                  onChange={(event) =>
                    updateField("latitude", event.target.value)
                  }
                />
              </Field>
              <Field
                id="longitude"
                label={messages.tenders.longitude}
                error={issueFor(issues, "longitude")}
              >
                <input
                  name="longitude"
                  type="number"
                  min="-180"
                  max="180"
                  step="any"
                  inputMode="decimal"
                  required
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
                minLength={3}
                maxLength={240}
                required
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
                {messages.tenders.attachmentCount.replace(
                  "{count}",
                  String(attachmentNames.length),
                )}
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
            onBack={() => moveToStep(1)}
          />
        </form>
      ) : null}

      {step === 3 ? (
        <form
          className="identity-form"
          data-dirty={hasUnsavedWork ? "true" : "false"}
          aria-labelledby={stepHeadingId(3)}
          noValidate
          onSubmit={publish}
        >
          <h2 className="wizard-step-title" id={stepHeadingId(3)} tabIndex={-1}>
            {messages.tenders.wizardReviewStep}
          </h2>
          <ErrorSummary
            issues={issues}
            summaryOne={messages.errors.summaryOne}
            summaryMany={messages.errors.summaryMany}
          />
          <dl className="wizard-review">
            {[
              [
                messages.tenders.filterSpecialty,
                messages.tenders.specialtyConstructionRepair,
              ],
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
              onClick={() => moveToStep(2)}
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
