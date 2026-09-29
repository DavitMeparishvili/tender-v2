"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Locale } from "../../localization/config";
import type { Messages } from "../../localization/get-messages";
import { Field } from "../../identity/ui/field";
import {
  ErrorSummary,
  focusErrorSummary,
  type FormIssue,
} from "../../identity/ui/identity-form";
import type { GeorgianPlaceOption } from "../application/list-georgian-places";
import type { AuthoringDetails } from "../application/save-tender-authoring";
import { formatAttachmentSize } from "./tender-format";
import {
  majorUnitsToMinor,
  onPinSelected,
  pinCoordinates,
  shouldGuardWizardLink,
  toLocationCommand,
  validateWizardStep,
  type TenderWizardFormState,
} from "./tender-wizard";
import {
  localizedServices,
  localizedSpecialties,
  serviceLabel,
  specialtyLabel,
} from "./tender-taxonomy";
import type {
  TenderSpecialty,
  TenderServiceCode,
} from "../domain/service-taxonomy";
import { AmountInput } from "./amount-input";
import { DateField, DateTimeField } from "./date-field";
import { datePickerCopy, locationMapCopy } from "./tender-action-copy";
import {
  parseDateInputValue,
  parseGeorgiaDateTimeLocal,
} from "./georgia-date-time";
import { WorkItemsEditor } from "./work-items-editor";
import { LocationMap } from "./location-map";
import { GeorgianPlaceSelect } from "./georgian-place-select";
import { TenderIcon } from "./tender-icon";
import {
  TenderFact,
  TenderMoney,
  tenderDate,
  tenderMoney,
} from "./tender-heading";
import {
  TenderSections,
  isPhoto,
  type AttachmentPreview,
} from "./tender-sections";
import { tenderPageCopy } from "./tender-page-copy";
import { tenderAuthoringCopy } from "./tender-authoring-copy";
import { coarsenCoordinates } from "../domain/coordinates";
import { AttachmentDownloadButton } from "./attachment-download-button";

type EditorFile = AttachmentPreview & {
  uploadId?: string;
  progress?: number;
  failed?: boolean;
};
const sectionIds = [
  "project",
  "work",
  "budget-dates",
  "files",
  "project-location",
] as const;

export function authoringDetails(
  form: TenderWizardFormState,
): AuthoringDetails {
  const description = form.fullDescription?.trim() ?? "";
  return {
    specialty: form.specialty!,
    serviceCode: form.serviceCode!,
    title: form.title?.trim() ?? "",
    fullDescription: description || null,
    shortDescription:
      form.shortDescription?.trim() || description.slice(0, 240) || null,
    scopeOfWork: form.scopeOfWork?.trim() || description.slice(0, 2000) || null,
    workItems: [...(form.workItems ?? [])],
    areaSquareMeters: form.areaSquareMeters
      ? Number(form.areaSquareMeters)
      : null,
    budgetMinorUnits: majorUnitsToMinor(form.budget),
    currency: form.currency ?? "GEL",
    deadline: parseGeorgiaDateTimeLocal(form.deadline ?? ""),
    desiredStartDate: form.desiredStartDate
      ? parseDateInputValue(form.desiredStartDate)
      : null,
    workerNotes: form.workerNotes?.trim() || null,
    equipmentNotes: form.equipmentNotes?.trim() || null,
    materialNotes: form.materialNotes?.trim() || null,
    conditions: form.conditions?.trim() || null,
  };
}

export function TenderAuthoring({
  locale,
  messages,
  places,
  initialForm = {},
  initialTenderId,
  initialAttachments = [],
  published = false,
  reference,
}: {
  locale: Locale;
  messages: Messages;
  places: readonly GeorgianPlaceOption[];
  initialForm?: TenderWizardFormState;
  initialTenderId?: string;
  initialAttachments?: readonly AttachmentPreview[];
  published?: boolean;
  reference?: string | null;
}) {
  const c = tenderAuthoringCopy(locale),
    d = tenderPageCopy(locale),
    m = messages.tenders;
  const [form, setForm] = useState<TenderWizardFormState>({
    title: "",
    fullDescription: "",
    currency: "GEL",
    locationMode: "ADDRESS",
    ...initialForm,
  });
  const [id, setId] = useState(initialTenderId);
  const [files, setFiles] = useState<EditorFile[]>([...initialAttachments]);
  const [active, setActive] = useState(0);
  const [review, setReview] = useState(false);
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [issues, setIssues] = useState<readonly FormIssue[]>([]);
  const [adjustPin, setAdjustPin] = useState(false);
  const allowNavigation = useRef(false);
  const uploadRequests = useRef(new Map<string, XMLHttpRequest>());
  const objectUrls = useRef(new Set<string>());
  const busy = useRef(false);
  const savedLocationForm = useRef(initialForm);
  const currencyTouched = useRef(initialForm.currency !== undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploading = files.some((file) => file.progress !== undefined);
  const blocked = pending || uploading || files.some((file) => file.failed);
  const selectedPlace = places.find(
    (place) => String(place.id) === form.placeId,
  );
  const city = [selectedPlace?.label ?? form.city, form.district]
    .filter(Boolean)
    .join(" · ");
  const labels = [
    c.overview,
    c.quantities,
    c.budget,
    c.attachments,
    c.location,
  ];
  const destination = `/${locale}/client/tenders${published && id ? `/${id}` : ""}`;

  useEffect(() => {
    const urls = objectUrls.current,
      requests = uploadRequests.current;
    return () => {
      requests.forEach((request) => request.abort());
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  useEffect(() => {
    let active = true;
    if (!currencyTouched.current)
      void fetch("/api/profile/me")
        .then((r) => r.json())
        .then((result) => {
          const currency = result.profile?.preferredCurrency;
          if (
            active &&
            !currencyTouched.current &&
            (currency === "GEL" || currency === "USD")
          )
            setForm((value) => ({ ...value, currency }));
        })
        .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!dirty && !uploading) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!allowNavigation.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const click = (event: MouseEvent) => {
      const anchor =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (
        allowNavigation.current ||
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey
      )
        return;
      if (
        shouldGuardWizardLink(window.location.href, anchor.href) &&
        !window.confirm(m.dirtyWarning)
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty, uploading, m.dirtyWarning]);
  useEffect(() => {
    if (review) {
      document.getElementById("authoring-heading")?.focus();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
        if (visible)
          setActive(
            sectionIds.indexOf(
              visible.target.id as (typeof sectionIds)[number],
            ),
          );
      },
      { rootMargin: "-100px 0px -55% 0px" },
    );
    sectionIds.forEach((section) => {
      const element = document.getElementById(section);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [review]);
  function update(patch: Partial<TenderWizardFormState>) {
    setForm((value) => ({
      ...value,
      ...(patch.fullDescription !== undefined &&
      value.shortDescription === value.fullDescription?.slice(0, 240)
        ? { shortDescription: patch.fullDescription.slice(0, 240) }
        : {}),
      ...(patch.fullDescription !== undefined &&
      value.scopeOfWork === value.fullDescription?.slice(0, 2000)
        ? { scopeOfWork: patch.fullDescription.slice(0, 2000) }
        : {}),
      ...patch,
    }));
    setDirty(true);
    setSaved(false);
    setIssues([]);
  }
  function showIssues(value: readonly FormIssue[]) {
    setIssues(value);
    setReview(false);
    setTimeout(focusErrorSummary, 0);
  }
  function validate(complete: boolean) {
    const normalized = {
      ...form,
      shortDescription:
        form.shortDescription || form.fullDescription?.slice(0, 240) || "",
      scopeOfWork:
        form.scopeOfWork || form.fullDescription?.slice(0, 2000) || "",
    };
    const errors = validateWizardStep(0, normalized, messages);
    const scopeIssues = validateWizardStep(1, normalized, messages).filter(
      (issue) =>
        complete ||
        Boolean(normalized[issue.field as keyof TenderWizardFormState]),
    );
    errors.push(
      ...scopeIssues
        .filter(
          (issue) =>
            (issue.field !== "shortDescription" &&
              issue.field !== "scopeOfWork") ||
            Boolean(form[issue.field]),
        )
        .map((issue) =>
          issue.field === "shortDescription" || issue.field === "scopeOfWork"
            ? { ...issue, field: "fullDescription" }
            : issue,
        ),
    );
    if (complete || form.city || form.addressLine || form.latitude)
      errors.push(...validateWizardStep(2, form, messages));
    if (
      form.areaSquareMeters &&
      (!Number.isFinite(Number(form.areaSquareMeters)) ||
        Number(form.areaSquareMeters) <= 0 ||
        Number(form.areaSquareMeters) > 1_000_000)
    )
      errors.push({
        field: "areaSquareMeters",
        message: m.errors.invalidInput,
      });
    if (
      form.workItems?.some(
        (item) =>
          !item.name.trim() ||
          !item.unit.trim() ||
          !Number.isFinite(item.quantity) ||
          item.quantity <= 0 ||
          item.quantity > 1_000_000_000,
      )
    )
      errors.push({ field: "work", message: d.workItemsHint });
    if (errors.length) {
      showIssues(errors);
      return false;
    }
    return true;
  }
  async function jsonRequest(url: string, method: string, body?: unknown) {
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = await response.json();
    if (!response.ok) {
      const code = result.code ?? result.error;
      const mapped: Record<string, string> = {
        EDIT_NOT_ALLOWED: d.editBlocked,
        NOT_DRAFT: d.editBlocked,
        ADDRESS_NOT_FOUND: m.errors.addressNotFound,
        COORDINATES_NOT_FOUND: m.errors.addressNotFound,
        DEADLINE_NOT_FUTURE: m.errors.deadlineNotFuture,
        FILE_TOO_LARGE: m.errors.fileTooLarge,
        TOO_MANY_ATTACHMENTS: m.errors.tooManyAttachments,
        UNSUPPORTED_FILE_TYPE: m.errors.unsupportedFileType,
        INVALID_INPUT: m.errors.invalidInput,
      };
      throw new Error(mapped[code] ?? messages.errors.generic);
    }
    return result;
  }
  async function ensureId() {
    if (id) return id;
    const result = await jsonRequest("/api/tenders", "POST", {
      specialty: form.specialty,
      serviceCode: form.serviceCode,
      title: form.title?.trim(),
    });
    const tenderId = result.tender.id as string;
    setId(tenderId);
    window.history.replaceState(
      null,
      "",
      `/${locale}/client/tenders/new?tenderId=${tenderId}`,
    );
    return tenderId;
  }
  async function persist(complete: boolean) {
    if (!validate(complete)) return null;
    const tenderId = await ensureId();
    // Do not re-geocode an unchanged stored location: its address and exact pin are one record.
    const locationChanged =
      !initialTenderId ||
      [
        "locationMode",
        "placeId",
        "city",
        "district",
        "addressLine",
        "latitude",
        "longitude",
      ].some(
        (key) =>
          form[key as keyof TenderWizardFormState] !==
          savedLocationForm.current[key as keyof TenderWizardFormState],
      );
    await jsonRequest(`/api/tenders/${tenderId}/authoring`, "PATCH", {
      details: authoringDetails(form),
      ...(locationChanged
        ? { location: form.city ? toLocationCommand(form) : null }
        : {}),
      retainedAttachmentIds: files
        .filter((file) => !file.uploadId)
        .map((file) => file.id),
      uploads: files
        .filter((file) => file.uploadId)
        .map((file) => ({
          uploadId: file.uploadId,
          originalFileName: file.originalFileName,
        })),
    });
    savedLocationForm.current = { ...form };
    const savedTender = await jsonRequest(`/api/tenders/${tenderId}`, "GET");
    if (savedTender.tender.location) {
      const location = savedTender.tender.location;
      const resolved = {
        ...form,
        locationMode: location.mode,
        placeId: location.placeId ? String(location.placeId) : "",
        city: location.city,
        district: location.district ?? "",
        addressLine: location.addressLine,
        latitude: String(location.exact.latitude),
        longitude: String(location.exact.longitude),
      };
      savedLocationForm.current = resolved;
      setForm(resolved);
    }
    setFiles((current) =>
      current.map((file) => {
        const savedFile = { ...file };
        delete savedFile.uploadId;
        return savedFile;
      }),
    );
    setDirty(false);
    setSaved(true);
    return tenderId;
  }
  async function action(kind: "draft" | "review" | "save" | "publish") {
    if (blocked || busy.current) return;
    busy.current = true;
    setPending(true);
    setIssues([]);
    try {
      if (kind === "review") {
        if (!validate(true)) return;
        setReview(true);
        window.scrollTo({ top: 0 });
        return;
      }
      const tenderId = await persist(kind !== "draft");
      if (!tenderId) return;
      if (kind === "publish")
        await jsonRequest(`/api/tenders/${tenderId}/publish`, "POST");
      if (kind === "save" || kind === "publish") {
        allowNavigation.current = true;
        window.location.assign(`/${locale}/client/tenders/${tenderId}`);
      }
    } catch (error) {
      showIssues([
        {
          field: "authoring-heading",
          message:
            error instanceof Error ? error.message : messages.errors.generic,
        },
      ]);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function upload(selected: File[]) {
    if (busy.current || uploading || pending || !selected.length) return;
    const basics = validateWizardStep(0, form, messages);
    if (basics.length) {
      showIssues(basics);
      return;
    }
    if (files.length + selected.length > 10) {
      showIssues([{ field: "files", message: m.errors.tooManyAttachments }]);
      return;
    }
    if (
      selected.some((file) => file.size > 15 * 1024 * 1024 || file.size === 0)
    ) {
      showIssues([{ field: "files", message: m.errors.fileTooLarge }]);
      return;
    }
    busy.current = true;
    setPending(true);
    try {
      const tenderId = await ensureId();
      for (const file of selected) {
        const contentType = file.name.toLowerCase().endsWith(".dwg")
          ? "image/vnd.dwg"
          : file.type;
        const prepared = await jsonRequest(
          `/api/tenders/${tenderId}/authoring/upload`,
          "POST",
          { originalFileName: file.name, sizeBytes: file.size, contentType },
        );
        const url = URL.createObjectURL(file);
        objectUrls.current.add(url);
        const fileId = prepared.uploadId as string;
        setFiles((value) => [
          ...value,
          {
            id: fileId,
            uploadId: fileId,
            originalFileName: file.name,
            sizeBytes: file.size,
            mimeType: contentType,
            url,
            progress: 0,
          },
        ]);
        setDirty(true);
        setSaved(false);
        const request = new XMLHttpRequest();
        uploadRequests.current.set(fileId, request);
        request.open("PUT", prepared.uploadUrl);
        request.setRequestHeader("content-type", prepared.contentType);
        request.setRequestHeader("if-none-match", "*");
        request.upload.onprogress = (event) => {
          if (event.lengthComputable)
            setFiles((value) =>
              value.map((item) =>
                item.id === fileId
                  ? {
                      ...item,
                      progress: Math.round((event.loaded / event.total) * 100),
                    }
                  : item,
              ),
            );
        };
        const done = () => uploadRequests.current.delete(fileId);
        request.onload = () => {
          done();
          setFiles((value) =>
            value.map((item) => {
              if (item.id !== fileId) return item;
              const rest = { ...item };
              delete rest.progress;
              return {
                ...rest,
                failed: request.status < 200 || request.status >= 300,
              };
            }),
          );
        };
        request.onerror = () => {
          done();
          setFiles((value) =>
            value.map((item) => {
              if (item.id !== fileId) return item;
              const rest = { ...item };
              delete rest.progress;
              return { ...rest, failed: true };
            }),
          );
        };
        request.onabort = done;
        request.send(file);
      }
    } catch (error) {
      showIssues([
        {
          field: "files",
          message:
            error instanceof Error ? error.message : messages.errors.generic,
        },
      ]);
    } finally {
      busy.current = false;
      setPending(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  function removeFile(file: EditorFile) {
    uploadRequests.current.get(file.id)?.abort();
    setFiles((value) => value.filter((item) => item.id !== file.id));
    setDirty(true);
    setSaved(false);
  }
  function jump(index: number) {
    setActive(index);
    document
      .getElementById(sectionIds[index]!)
      ?.scrollIntoView({ behavior: "instant", block: "start" });
  }
  function field(
    key: keyof TenderWizardFormState,
    label: string,
    options: {
      required?: boolean;
      minLength?: number;
      maxLength?: number;
      textarea?: boolean;
      description?: string;
    } = {},
  ) {
    const { textarea, ...props } = options;
    const control = {
      name: key,
      value: String(form[key] ?? ""),
      required: props.required,
      minLength: props.minLength,
      maxLength: props.maxLength,
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => update({ [key]: event.target.value }),
    };
    return (
      <Field
        id={key}
        label={label}
        requirement={
          props.required ? messages.common.required : messages.common.optional
        }
        error={issues.find((issue) => issue.field === key)?.message}
        description={[
          props.description,
          props.minLength
            ? messages.errors.minimumLength.replace(
                "{min}",
                String(props.minLength),
              )
            : null,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {textarea ? <textarea {...control} rows={4} /> : <input {...control} />}
      </Field>
    );
  }
  function privacy(text: string) {
    return (
      <p className="authoring-privacy">
        <TenderIcon name="lock" size={17} />
        <span>{text}</span>
      </p>
    );
  }
  function panel(index: number, children: ReactNode, hint?: string) {
    return (
      <section
        id={sectionIds[index]}
        className="tender-panel authoring-panel"
        tabIndex={-1}
      >
        <div className="authoring-panel-title">
          <h2>{labels[index]}</h2>
          {index === 3 ? (
            <span className="tender-badge neutral">
              {files.length} {c.slots}
            </span>
          ) : null}
        </div>
        {hint ? <p className="authoring-hint">{hint}</p> : null}
        {children}
      </section>
    );
  }
  const facts = (
    <dl className="authoring-facts">
      <TenderFact icon="wallet" label={m.budget}>
        <TenderMoney
          value={majorUnitsToMinor(form.budget)}
          currency={form.currency ?? "GEL"}
          locale={locale}
        />
      </TenderFact>
      <TenderFact icon="calendar" label={m.deadline}>
        {tenderDate(
          parseGeorgiaDateTimeLocal(form.deadline ?? ""),
          locale,
          true,
        )}
      </TenderFact>
      <TenderFact icon="calendar" label={m.desiredStartDate}>
        {tenderDate(parseDateInputValue(form.desiredStartDate ?? ""), locale)}
      </TenderFact>
      <TenderFact icon="pin" label={c.location}>
        {city || "—"}
      </TenderFact>
    </dl>
  );
  const point =
    pinCoordinates(form) ??
    (selectedPlace
      ? { latitude: selectedPlace.latitude, longitude: selectedPlace.longitude }
      : null);

  return (
    <div className="tender-page tender-authoring">
      <div className="tender-container">
        <Link className="tender-back authoring-back" href={destination}>
          <TenderIcon name="back" size={17} />
          {c.yourTenders}
        </Link>
        <header className="authoring-header">
          <div>
            <div className="authoring-title-row">
              <h1 id="authoring-heading" tabIndex={-1}>
                {review ? c.review : published ? c.edit : c.create}
              </h1>
              <span className={`tender-badge ${published ? "" : "neutral"}`}>
                {published ? m.statusPublished : m.statusDraft}
              </span>
            </div>
            <p>
              {review ? c.reviewHint : published ? initialForm.title : c.intro}
            </p>
            {!review ? (
              <p className="authoring-hint">{m.requiredFieldsHint}</p>
            ) : null}
            {published && !review ? (
              <p className="authoring-hint">{c.editingHint}</p>
            ) : null}
          </div>
          {!review ? (
            published ? (
              <Link
                href={`/${locale}/client/tenders/${id}`}
                className="tender-button authoring-header-action"
              >
                <TenderIcon name="external" size={17} />
                {c.view}
              </Link>
            ) : (
              <button
                type="button"
                className="tender-button authoring-header-action"
                disabled={blocked}
                onClick={() => void action("draft")}
              >
                <TenderIcon name="save" size={17} />
                {c.saveDraft}
              </button>
            )
          ) : null}
        </header>
        <ErrorSummary
          issues={issues.map((issue) => ({
            ...issue,
            label: (
              {
                specialty: m.filterSpecialty,
                serviceCode: m.filterService,
                title: m.title,
                fullDescription: c.description,
                budget: m.budget,
                deadline: m.deadline,
                desiredStartDate: m.desiredStartDate,
                city: m.city,
                addressLine: m.addressLine,
                latitude: c.location,
                longitude: c.location,
                areaSquareMeters: c.area,
                work: c.quantities,
              } as Record<string, string>
            )[issue.field],
          }))}
          summaryOne={messages.errors.summaryOne}
          summaryMany={messages.errors.summaryMany}
        />
        {saved ? (
          <p className="authoring-saved" role="status">
            {c.saved}
          </p>
        ) : null}
        {review ? (
          <div className="authoring-review">
            <section className="tender-panel">
              <h2>{form.title}</h2>
              <p className="authoring-review-meta">
                {form.specialty ? specialtyLabel(form.specialty, messages) : ""}{" "}
                ·{" "}
                {form.serviceCode
                  ? serviceLabel(form.serviceCode, messages)
                  : ""}
              </p>
              {facts}
            </section>
            <TenderSections
              locale={locale}
              messages={messages}
              description={form.fullDescription ?? null}
              scope={form.scopeOfWork ?? null}
              workerNotes={form.workerNotes ?? null}
              materialNotes={form.materialNotes ?? null}
              equipmentNotes={form.equipmentNotes ?? null}
              conditions={form.conditions ?? null}
              workItems={form.workItems ?? []}
              attachments={files.map((file, index) => ({
                ...file,
                originalFileName: `${isPhoto(file) ? d.photos : d.files} ${index + 1}`,
                url: null,
              }))}
              city={city}
              coordinates={point ? coarsenCoordinates(point) : null}
            />
            <p className="authoring-selection">
              <TenderIcon name="info" size={18} />
              {c.selection}
            </p>
          </div>
        ) : (
          <form
            className="authoring-layout"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void action("review");
            }}
          >
            <label className="authoring-mobile-nav">
              <span className="sr-only">{c.onPage}</span>
              <select
                value={active}
                onChange={(event) => jump(Number(event.target.value))}
              >
                {labels.map((label, index) => (
                  <option key={label} value={index}>
                    {index + 1} / 5 · {label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="authoring-fields" disabled={pending}>
              {panel(
                0,
                <>
                  <div className="authoring-two-columns">
                    <Field
                      id="specialty"
                      requirement={messages.common.required}
                      label={m.filterSpecialty}
                      error={
                        issues.find((issue) => issue.field === "specialty")
                          ?.message
                      }
                    >
                      <select
                        name="specialty"
                        required
                        value={form.specialty ?? ""}
                        onChange={(event) =>
                          update({
                            specialty: (event.target.value || undefined) as
                              TenderSpecialty | undefined,
                            serviceCode: undefined,
                          })
                        }
                      >
                        <option value="">{m.serviceSelectCategory}</option>
                        {localizedSpecialties(messages).map((option) => (
                          <option value={option.value} key={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      id="serviceCode"
                      requirement={messages.common.required}
                      label={m.filterService}
                      error={
                        issues.find((issue) => issue.field === "serviceCode")
                          ?.message
                      }
                    >
                      <select
                        name="serviceCode"
                        required
                        disabled={!form.specialty}
                        value={form.serviceCode ?? ""}
                        onChange={(event) =>
                          update({
                            serviceCode: event.target
                              .value as TenderServiceCode,
                          })
                        }
                      >
                        <option value="">{m.serviceSelectSpecific}</option>
                        {form.specialty
                          ? localizedServices(form.specialty, messages).map(
                              (option) => (
                                <option value={option.value} key={option.value}>
                                  {option.label}
                                </option>
                              ),
                            )
                          : null}
                      </select>
                    </Field>
                  </div>
                  {field("title", m.title, {
                    required: true,
                    minLength: 5,
                    maxLength: 160,
                  })}
                  {field("fullDescription", c.description, {
                    required: true,
                    minLength: 20,
                    textarea: true,
                    maxLength: 5000,
                    description: c.descriptionHint,
                  })}
                  <details className="authoring-requirements" open={undefined}>
                    <summary>
                      <TenderIcon name="box" size={20} />
                      <span>
                        {c.requirements}
                        <small>{c.requirementsHint}</small>
                      </span>
                      <TenderIcon name="chevron" size={17} />
                    </summary>
                    <div className="authoring-two-columns">
                      {field("workerNotes", m.workerNotes, { maxLength: 1000 })}
                      {field("equipmentNotes", m.equipmentNotes, {
                        maxLength: 1000,
                      })}
                      {field("materialNotes", m.materialNotes, {
                        maxLength: 1000,
                      })}
                      {field("conditions", m.conditions, { maxLength: 2000 })}
                    </div>
                  </details>
                  {initialForm.shortDescription || initialForm.scopeOfWork ? (
                    <details className="authoring-legacy">
                      <summary>{c.legacy}</summary>
                      <p className="authoring-hint">{c.legacyHint}</p>
                      {field("shortDescription", m.shortDescription, {
                        textarea: true,
                        maxLength: 240,
                      })}
                      {field("scopeOfWork", m.scopeOfWork, {
                        textarea: true,
                        maxLength: 2000,
                      })}
                    </details>
                  ) : null}
                </>,
              )}
              {panel(
                1,
                <>
                  <WorkItemsEditor
                    locale={locale}
                    items={form.workItems ?? []}
                    onChange={(items) => update({ workItems: items })}
                  />
                  <div className="authoring-area">
                    <Field
                      id="areaSquareMeters"
                      label={c.area}
                      description={c.areaHint}
                      error={
                        issues.find(
                          (issue) => issue.field === "areaSquareMeters",
                        )?.message
                      }
                      suffix={<span className="authoring-area-unit">m²</span>}
                    >
                      <input
                        name="areaSquareMeters"
                        type="number"
                        min="0.01"
                        max="1000000"
                        step="any"
                        value={form.areaSquareMeters ?? ""}
                        onChange={(event) =>
                          update({ areaSquareMeters: event.target.value })
                        }
                      />
                    </Field>
                  </div>
                </>,
                c.quantitiesHint,
              )}
              {panel(
                2,
                <div className="authoring-two-columns authoring-budget">
                  <div className="authoring-money">
                    <Field
                      id="budget"
                      requirement={messages.common.required}
                      label={m.budget}
                      error={
                        issues.find((issue) => issue.field === "budget")
                          ?.message
                      }
                    >
                      <AmountInput
                        name="budget"
                        required
                        value={form.budget ?? ""}
                        onChange={(value) => update({ budget: value })}
                      />
                    </Field>
                    <Field
                      id="currency"
                      requirement={messages.common.required}
                      label={m.currency}
                    >
                      <select
                        name="currency"
                        required
                        disabled={published}
                        value={form.currency}
                        onChange={(event) => {
                          currencyTouched.current = true;
                          update({
                            currency: event.target.value as "GEL" | "USD",
                          });
                        }}
                      >
                        <option>GEL</option>
                        <option>USD</option>
                      </select>
                    </Field>
                  </div>
                  <Field
                    id="deadline"
                    requirement={messages.common.required}
                    label={m.deadline}
                    description={c.timeZone}
                    error={
                      issues.find((issue) => issue.field === "deadline")
                        ?.message
                    }
                  >
                    <DateTimeField
                      name="deadline"
                      required
                      locale={locale}
                      copy={datePickerCopy(messages)}
                      value={form.deadline ?? ""}
                      onChange={(value) => update({ deadline: value })}
                    />
                  </Field>
                  <Field
                    id="desiredStartDate"
                    label={m.desiredStartDate}
                    requirement={messages.common.optional}
                    error={
                      issues.find((issue) => issue.field === "desiredStartDate")
                        ?.message
                    }
                  >
                    <DateField
                      name="desiredStartDate"
                      locale={locale}
                      copy={datePickerCopy(messages)}
                      value={form.desiredStartDate ?? ""}
                      onChange={(value) => update({ desiredStartDate: value })}
                    />
                  </Field>
                </div>,
              )}
              {panel(
                3,
                <>
                  <div
                    className="authoring-drop"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      void upload(Array.from(event.dataTransfer.files));
                    }}
                  >
                    <input
                      ref={fileInput}
                      id="attachment-input"
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf,.dwg"
                      multiple
                      disabled={pending || uploading || files.length >= 10}
                      onChange={(event) =>
                        void upload(Array.from(event.target.files ?? []))
                      }
                    />
                    <label htmlFor="attachment-input">
                      <TenderIcon name="upload" size={22} />
                      <span className="authoring-desktop-text">
                        {c.dropFiles}
                      </span>
                      <span className="authoring-mobile-text">
                        {c.addFiles}
                      </span>
                    </label>
                    <p>{c.fileHint}</p>
                  </div>
                  <div className="authoring-photos">
                    {files
                      .filter(
                        (file) =>
                          isPhoto(file) &&
                          file.progress === undefined &&
                          !file.failed,
                      )
                      .map((file) => (
                        <div key={file.id}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={file.url ?? ""}
                            alt={file.originalFileName}
                          />
                          <button
                            className="authoring-remove"
                            type="button"
                            aria-label={`${c.remove} ${file.originalFileName}`}
                            onClick={() => removeFile(file)}
                          >
                            <TenderIcon name="close" size={15} />
                          </button>
                        </div>
                      ))}
                  </div>
                  <ul className="authoring-documents">
                    {files
                      .filter(
                        (file) =>
                          !isPhoto(file) ||
                          file.progress !== undefined ||
                          file.failed,
                      )
                      .map((file) => (
                        <li key={file.id}>
                          <span
                            className={`tender-file-icon ${file.mimeType === "application/pdf" ? "pdf" : "cad"}`}
                          >
                            {file.mimeType === "application/pdf"
                              ? "PDF"
                              : isPhoto(file)
                                ? "IMG"
                                : "DWG"}
                          </span>
                          <div className="authoring-file-meta">
                            <strong>{file.originalFileName}</strong>
                            {file.progress !== undefined ? (
                              <>
                                <progress
                                  max={100}
                                  value={file.progress}
                                  aria-label={`${c.uploading} ${file.originalFileName}`}
                                />
                                <span>
                                  {c.uploading} · {file.progress}%
                                </span>
                              </>
                            ) : file.failed ? (
                              <span role="alert">{c.uploadFailed}</span>
                            ) : (
                              <span>
                                {formatAttachmentSize(file.sizeBytes, locale, {
                                  bytes: m.attachmentSizeBytes,
                                  kilobytes: m.attachmentSizeKilobytes,
                                  megabytes: m.attachmentSizeMegabytes,
                                })}
                              </span>
                            )}
                          </div>
                          {file.progress === undefined &&
                          !file.failed &&
                          file.url ? (
                            file.mimeType !== "application/pdf" ? (
                              <AttachmentDownloadButton
                                url={file.url}
                                fileName={file.originalFileName}
                                label={c.download}
                                errorLabel={messages.errors.generic}
                                showLabel
                                resolveUrl={async () =>
                                  file.url?.startsWith("blob:")
                                    ? file.url
                                    : (
                                        await jsonRequest(
                                          `/api/tenders/${id}/attachments/${file.id}/download`,
                                          "GET",
                                        )
                                      ).url
                                }
                              />
                            ) : (
                              <a
                                className="tender-button small"
                                href={file.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {c.previewFile}
                              </a>
                            )
                          ) : null}
                          <button
                            className="tender-button icon-only"
                            type="button"
                            aria-label={`${file.progress !== undefined ? c.cancel : c.remove} ${file.originalFileName}`}
                            onClick={() => removeFile(file)}
                          >
                            <TenderIcon name="close" size={17} />
                          </button>
                        </li>
                      ))}
                  </ul>
                  {!files.length ? (
                    <p className="authoring-hint">{c.noFiles}</p>
                  ) : null}
                  {privacy(c.filesPrivacy)}
                  {uploading ? (
                    <p role="status" className="authoring-hint">
                      {c.uploadWait}
                    </p>
                  ) : null}
                </>,
                c.attachmentHint,
              )}
              {panel(
                4,
                <>
                  <div className="authoring-two-columns">
                    <Field
                      id="city"
                      requirement={messages.common.required}
                      label={m.city}
                      error={
                        issues.find((issue) => issue.field === "city")?.message
                      }
                    >
                      <GeorgianPlaceSelect
                        name="placeId"
                        places={places}
                        placeholder={m.placePlaceholder}
                        fallbackLabel={form.city}
                        required
                        value={form.placeId ?? ""}
                        onChange={(event) => {
                          const place = places.find(
                            (value) => String(value.id) === event.target.value,
                          );
                          update({
                            placeId: event.target.value,
                            city: place?.nameEn ?? "",
                            latitude: "",
                            longitude: "",
                            addressLine: "",
                            district: "",
                            locationMode: "ADDRESS",
                          });
                        }}
                      />
                    </Field>
                    {field("district", m.district, {
                      maxLength: 120,
                    })}
                  </div>
                  <Field
                    id="addressLine"
                    label={m.addressLine}
                    requirement={
                      form.locationMode === "PIN"
                        ? messages.common.optional
                        : messages.common.required
                    }
                    error={
                      issues.find((issue) => issue.field === "addressLine")
                        ?.message
                    }
                    description={c.addressHint}
                  >
                    <input
                      name="addressLine"
                      required={form.locationMode !== "PIN"}
                      minLength={3}
                      maxLength={240}
                      value={form.addressLine ?? ""}
                      onChange={(event) =>
                        update({
                          addressLine: event.target.value,
                          locationMode: "ADDRESS",
                          latitude: "",
                          longitude: "",
                        })
                      }
                    />
                  </Field>
                  <div
                    className={`authoring-map tender-location ${adjustPin ? "is-adjusting" : ""}`}
                  >
                    <LocationMap
                      coordinates={pinCoordinates(form)}
                      focusCoordinates={
                        selectedPlace
                          ? {
                              latitude: selectedPlace.latitude,
                              longitude: selectedPlace.longitude,
                            }
                          : null
                      }
                      precision="PRECISE"
                      copy={locationMapCopy(messages)}
                      {...(adjustPin
                        ? {
                            onPick: (coordinates: {
                              latitude: number;
                              longitude: number;
                            }) =>
                              update({
                                ...onPinSelected(coordinates),
                                locationMode: "PIN",
                              }),
                          }
                        : {})}
                    />
                    <button
                      type="button"
                      className="tender-button small authoring-map-adjust"
                      aria-pressed={adjustPin}
                      onClick={() => setAdjustPin(!adjustPin)}
                    >
                      <TenderIcon name="pin" size={16} />
                      {c.adjustPin}
                    </button>
                  </div>
                  {adjustPin ? (
                    <p className="authoring-hint">{c.pinHint}</p>
                  ) : null}
                  {form.locationMode === "PIN" ? (
                    <p className="authoring-hint">{m.locationPinned}</p>
                  ) : null}
                  {privacy(c.locationPrivacy)}
                </>,
              )}
            </fieldset>
            <aside className="authoring-sidebar">
              <nav className="tender-panel" aria-label={c.onPage}>
                <h2>{c.onPage}</h2>
                <ol>
                  {labels.map((label, index) => (
                    <li key={label}>
                      <a
                        href={`#${sectionIds[index]}`}
                        aria-current={active === index ? "location" : undefined}
                        onClick={() => setActive(index)}
                      >
                        <span>{index + 1}</span>
                        {label}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
              <section className="tender-panel authoring-summary">
                <div className="authoring-panel-title">
                  <h2>{published ? c.publishedSummary : c.summary}</h2>
                  <span
                    className={`tender-badge ${published ? "" : "neutral"}`}
                  >
                    {published ? m.statusPublished : m.statusDraft}
                  </span>
                </div>
                <h3>{form.title || c.emptyTitle}</h3>
                <p>
                  <TenderIcon name="wallet" size={18} />
                  {tenderMoney(
                    majorUnitsToMinor(form.budget),
                    form.currency ?? "GEL",
                    locale,
                  )}
                </p>
                <p>
                  <TenderIcon name="pin" size={18} />
                  {city || "—"}
                </p>
                <p>
                  <TenderIcon name="inbox" size={18} />
                  {form.workItems?.length ?? 0} {c.quantities.toLowerCase()}
                </p>
                <p>
                  <TenderIcon name="clip" size={18} />
                  {files.filter(isPhoto).length} {d.photos} ·{" "}
                  {files.filter((file) => !isPhoto(file)).length} {d.files}
                </p>
                {reference ? <p>{reference}</p> : null}
                {!published ? (
                  <span className="tender-badge neutral">{c.unpublished}</span>
                ) : null}
              </section>
              <div className="authoring-sidebar-notice">
                {privacy(published ? c.editingHint : c.privacy)}
                {published ? (
                  <button
                    type="button"
                    className="tender-button"
                    disabled={blocked}
                    onClick={() => void action("review")}
                  >
                    <TenderIcon name="eye" size={19} />
                    {c.preview}
                  </button>
                ) : null}
              </div>
            </aside>
          </form>
        )}
      </div>
      <div className="authoring-actions tender-mobile-actions">
        <div>
          <Link className="authoring-discard" href={destination}>
            {published ? c.discard : c.cancel}
          </Link>
          <div className="authoring-action-buttons">
            <button
              type="button"
              className="tender-button"
              disabled={blocked}
              onClick={() =>
                review
                  ? (setReview(false), window.scrollTo({ top: 0 }))
                  : void action(published ? "review" : "draft")
              }
            >
              {!review ? (
                <TenderIcon name={published ? "eye" : "save"} size={18} />
              ) : null}
              {review ? c.back : published ? c.preview : c.saveDraft}
            </button>
            <button
              type="button"
              className="tender-button primary"
              disabled={blocked}
              onClick={() =>
                void action(published ? "save" : review ? "publish" : "review")
              }
            >
              {pending
                ? d.saving
                : published
                  ? c.save
                  : review
                    ? m.publish
                    : c.reviewAction}
              <TenderIcon name="arrow" size={19} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
