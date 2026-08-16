"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Field } from "../../identity/ui/field";
import {
  TENDER_SPECIALTIES,
  isServiceForSpecialty,
  isTenderServiceCode,
  isTenderSpecialty,
  servicesForSpecialty,
  type TenderServiceCode,
  type TenderSpecialty,
} from "../domain/service-taxonomy";
import {
  ErrorSummary,
  SubmitButton,
  type FormIssue,
} from "../../identity/ui/identity-form";
import {
  discoveryFilterKeys,
  parseDiscoverySearchParams,
  serializeDiscoveryFilters,
  type DiscoveryFilterKey,
  type DiscoveryFilterValues,
} from "./discovery-query";

const QUICK_CITIES = ["Tbilisi", "Batumi", "Kutaisi", "Rustavi"] as const;
const QUICK_DEADLINE_DAYS = [7, 30, 90] as const;

export type DiscoveryFilterCopy = Readonly<{
  apply: string;
  pending: string;
  specialty: string;
  allSpecialties: string;
  service: string;
  allServices: string;
  selectCategory: string;
  serviceHint: string;
  specialtyLabels: Readonly<Record<TenderSpecialty, string>>;
  serviceLabels: Readonly<Record<TenderServiceCode, string>>;
  city: string;
  budgetRange: string;
  minimumBudget: string;
  maximumBudget: string;
  currency: string;
  currencyHint: string;
  anyCurrency: string;
  currencyRequired: string;
  deadlineBefore: string;
  deadlineHint: string;
  invalidInput: string;
  invalidBudgetRange: string;
  summaryOne: string;
  summaryMany: string;
  /** Rail chrome. */
  title: string;
  clearAll: string;
  openFilters: string;
  closeFilters: string;
  reset: string;
  saveSearch: string;
  quickCity: string;
  dayChips: Readonly<Record<7 | 30 | 90, string>>;
}>;

function formValue(formData: FormData, key: keyof DiscoveryFilterValues) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

// The budget inputs are `type="text"` so they can display thousands
// separators as the client types — a plain `type="number"` control refuses
// to render (or even accept) a comma at all. `formatBudgetInput` reformats
// on every keystroke; `stripBudgetInput` undoes it before the value reaches
// `majorUnitsToMinorUnits`, which only ever parses plain digits.
function formatBudgetInput(raw: string): string {
  const digitsAndDot = raw.replace(/[^\d.]/g, "");
  const dotIndex = digitsAndDot.indexOf(".");
  const integerPart =
    dotIndex === -1 ? digitsAndDot : digitsAndDot.slice(0, dotIndex);
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (dotIndex === -1) return groupedInteger;

  const decimalDigits = digitsAndDot
    .slice(dotIndex + 1)
    .replace(/\./g, "")
    .slice(0, 2);
  return `${groupedInteger}.${decimalDigits}`;
}

function stripBudgetInput(value: string): string {
  return value.replace(/,/g, "");
}

// Each budget fault is associated with the field that actually caused it —
// an invalid decimal in just one of `minBudget`/`maxBudget`, or both together
// for a reversed range, per `parseDiscoverySearchParams`'s `fields` array —
// rather than always pointing at `minBudget`. That keeps the error-summary
// link (and each `Field`'s own `aria-describedby`/`aria-invalid`) landing on
// the control that is actually wrong.
export function discoveryFilterIssues(
  invalidFields: ReadonlySet<DiscoveryFilterKey>,
  copy: Pick<
    DiscoveryFilterCopy,
    "invalidInput" | "invalidBudgetRange" | "currencyRequired"
  >,
): FormIssue[] {
  const issues: FormIssue[] = [];
  if (invalidFields.has("specialty"))
    issues.push({ field: "specialty", message: copy.invalidInput });
  if (invalidFields.has("serviceCode"))
    issues.push({ field: "serviceCode", message: copy.invalidInput });
  if (invalidFields.has("city"))
    issues.push({ field: "city", message: copy.invalidInput });
  if (invalidFields.has("minBudget"))
    issues.push({ field: "minBudget", message: copy.invalidBudgetRange });
  if (invalidFields.has("maxBudget"))
    issues.push({ field: "maxBudget", message: copy.invalidBudgetRange });
  if (invalidFields.has("currency"))
    issues.push({ field: "currency", message: copy.currencyRequired });
  if (invalidFields.has("deadlineBefore"))
    issues.push({ field: "deadlineBefore", message: copy.invalidInput });
  return issues;
}

function isoDateInDays(days: number): string {
  const target = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return target.toISOString().slice(0, 10);
}

export function DiscoveryFilters({
  copy,
}: Readonly<{ copy: DiscoveryFilterCopy }>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, setPending] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const initialSpecialtyValue = searchParams.get("specialty") ?? "";
  const initialServiceValue = searchParams.get("serviceCode") ?? "";
  const [specialty, setSpecialty] = useState<TenderSpecialty | undefined>(
    isTenderSpecialty(initialSpecialtyValue)
      ? initialSpecialtyValue
      : undefined,
  );
  const [serviceCode, setServiceCode] = useState<TenderServiceCode | undefined>(
    isTenderServiceCode(initialServiceValue) &&
      isTenderSpecialty(initialSpecialtyValue) &&
      isServiceForSpecialty(initialServiceValue, initialSpecialtyValue)
      ? initialServiceValue
      : undefined,
  );
  const [city, setCity] = useState(searchParams.get("city") ?? "");
  const [minBudget, setMinBudget] = useState(
    formatBudgetInput(searchParams.get("minBudget") ?? ""),
  );
  const [maxBudget, setMaxBudget] = useState(
    formatBudgetInput(searchParams.get("maxBudget") ?? ""),
  );
  const [deadlineBefore, setDeadlineBefore] = useState(
    searchParams.get("deadlineBefore") ?? "",
  );
  const [currency, setCurrency] = useState(searchParams.get("currency") ?? "");

  const queryKey = searchParams.toString();
  const currentValues = Object.fromEntries(
    discoveryFilterKeys.map((key) => {
      const values = searchParams.getAll(key);
      return [key, values.length > 1 ? values : values[0]];
    }),
  );
  const parsed = parseDiscoverySearchParams(currentValues);
  const invalidFields = new Set(parsed.ok ? [] : parsed.fields);
  const minBudgetError = invalidFields.has("minBudget")
    ? copy.invalidBudgetRange
    : undefined;
  const maxBudgetError = invalidFields.has("maxBudget")
    ? copy.invalidBudgetRange
    : undefined;
  const issues = discoveryFilterIssues(invalidFields, copy);

  // The sheet is a modal surface on phones: Escape closes it and focus
  // returns to the control that opened it.
  useEffect(() => {
    if (!sheetOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSheetOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sheetOpen]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const values: DiscoveryFilterValues = {
      specialty: formValue(formData, "specialty"),
      serviceCode: formValue(formData, "serviceCode"),
      city: formValue(formData, "city"),
      minBudget: stripBudgetInput(formValue(formData, "minBudget")),
      maxBudget: stripBudgetInput(formValue(formData, "maxBudget")),
      currency: formValue(formData, "currency"),
      deadlineBefore: formValue(formData, "deadlineBefore"),
    };
    // A new predicate set means a new result set, so paging restarts at one
    // rather than landing the provider on an arbitrary slice of it.
    const preserved = new URLSearchParams(searchParams.toString());
    preserved.delete("page");
    const href = serializeDiscoveryFilters(pathname, preserved, values);
    setPending(true);
    setSheetOpen(false);
    router.push(href);
  }

  const activeCount = discoveryFilterKeys.filter((key) =>
    Boolean(searchParams.get(key)),
  ).length;

  return (
    <>
      <button
        aria-controls={panelId}
        aria-expanded={sheetOpen}
        className="pill pill-ink filter-sheet-trigger"
        onClick={() => setSheetOpen(true)}
        ref={triggerRef}
        type="button"
      >
        {copy.openFilters}
        {activeCount > 0 ? (
          <span className="filter-badge">{activeCount}</span>
        ) : null}
      </button>

      {sheetOpen ? (
        <button
          aria-label={copy.closeFilters}
          className="filter-scrim"
          onClick={() => setSheetOpen(false)}
          type="button"
        />
      ) : null}

      <form
        aria-label={copy.title}
        className="filter-rail"
        data-sheet-open={sheetOpen ? "true" : "false"}
        id={panelId}
        key={queryKey}
        onSubmit={submit}
      >
        <span aria-hidden="true" className="sheet-handle" />

        <div className="filter-rail-head">
          <span>{copy.title}</span>
          <a href={pathname}>{copy.clearAll}</a>
        </div>

        <div className="filter-group">
          <ErrorSummary
            issues={issues}
            summaryOne={copy.summaryOne}
            summaryMany={copy.summaryMany}
            id="filter-errors"
          />
          <Field
            id="specialty"
            label={copy.specialty}
            error={
              invalidFields.has("specialty") ? copy.invalidInput : undefined
            }
          >
            <select
              name="specialty"
              value={specialty ?? ""}
              onChange={(event) => {
                const nextSpecialty = isTenderSpecialty(event.target.value)
                  ? event.target.value
                  : undefined;
                setSpecialty(nextSpecialty);
                setServiceCode((current) =>
                  current !== undefined &&
                  nextSpecialty !== undefined &&
                  isServiceForSpecialty(current, nextSpecialty)
                    ? current
                    : undefined,
                );
              }}
            >
              <option value="">{copy.allSpecialties}</option>
              {TENDER_SPECIALTIES.map((value) => (
                <option key={value} value={value}>
                  {copy.specialtyLabels[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id="serviceCode"
            label={copy.service}
            description={copy.serviceHint}
            error={
              invalidFields.has("serviceCode") ? copy.invalidInput : undefined
            }
          >
            <select
              name="serviceCode"
              disabled={specialty === undefined}
              value={serviceCode ?? ""}
              onChange={(event) =>
                setServiceCode(
                  isTenderServiceCode(event.target.value)
                    ? event.target.value
                    : undefined,
                )
              }
            >
              <option value="">
                {specialty === undefined
                  ? copy.selectCategory
                  : copy.allServices}
              </option>
              {specialty === undefined
                ? null
                : servicesForSpecialty(specialty).map(({ code }) => (
                    <option key={code} value={code}>
                      {copy.serviceLabels[code]}
                    </option>
                  ))}
            </select>
          </Field>
        </div>

        <div className="filter-group">
          <Field
            id="city"
            label={copy.city}
            error={invalidFields.has("city") ? copy.invalidInput : undefined}
          >
            <input
              name="city"
              type="text"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              maxLength={120}
              autoComplete="address-level2"
            />
          </Field>
          <div aria-label={copy.quickCity} className="chip-row" role="group">
            {QUICK_CITIES.map((value) => (
              <button
                className="chip chip-quiet"
                key={value}
                onClick={() => setCity(value)}
                type="button"
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <fieldset className="discovery-budget-group">
            <legend>{copy.budgetRange}</legend>
            <div className="discovery-budget-fields budget-fields">
              <Field
                id="minBudget"
                label={copy.minimumBudget}
                error={minBudgetError}
              >
                <input
                  name="minBudget"
                  type="text"
                  inputMode="decimal"
                  value={minBudget}
                  onChange={(event) =>
                    setMinBudget(formatBudgetInput(event.target.value))
                  }
                />
              </Field>
              <Field
                id="maxBudget"
                label={copy.maximumBudget}
                error={maxBudgetError}
              >
                <input
                  name="maxBudget"
                  type="text"
                  inputMode="decimal"
                  value={maxBudget}
                  onChange={(event) =>
                    setMaxBudget(formatBudgetInput(event.target.value))
                  }
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className="discovery-budget-group">
            <legend>{copy.currency}</legend>
            <p className="field-description">{copy.currencyHint}</p>
            <div className="segmented">
              {[
                { value: "GEL", label: "GEL" },
                { value: "USD", label: "USD" },
                { value: "", label: copy.anyCurrency },
              ].map((option) => (
                <label key={option.label}>
                  <input
                    checked={currency === option.value}
                    name="currency"
                    onChange={() => setCurrency(option.value)}
                    type="radio"
                    value={option.value}
                  />
                  {option.label}
                </label>
              ))}
            </div>
            {invalidFields.has("currency") ? (
              <p className="field-error">{copy.currencyRequired}</p>
            ) : null}
          </fieldset>
        </div>

        <div className="filter-group">
          <Field
            id="deadlineBefore"
            label={copy.deadlineBefore}
            description={copy.deadlineHint}
            error={
              invalidFields.has("deadlineBefore")
                ? copy.invalidInput
                : undefined
            }
          >
            <input
              name="deadlineBefore"
              type="date"
              value={deadlineBefore}
              onChange={(event) => setDeadlineBefore(event.target.value)}
            />
          </Field>
          <div className="chip-row">
            {QUICK_DEADLINE_DAYS.map((days) => (
              <button
                className="chip chip-quiet"
                key={days}
                onClick={() => setDeadlineBefore(isoDateInDays(days))}
                type="button"
              >
                {copy.dayChips[days]}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-foot">
          <SubmitButton
            label={copy.apply}
            pendingLabel={copy.pending}
            isPending={isPending}
          />
          {/*
            Saved searches and their email digest are not built yet, so this
            states the intent without pretending to accept a subscription.
          */}
          <p className="save-search" title={copy.saveSearch}>
            {copy.saveSearch}
          </p>
        </div>
      </form>
    </>
  );
}
