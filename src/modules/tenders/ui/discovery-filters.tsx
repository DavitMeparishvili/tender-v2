"use client";

import { useTransition, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Field } from "../../identity/ui/field";
import {
  ErrorSummary,
  SubmitButton,
  type FormIssue,
} from "../../identity/ui/identity-form";
import {
  MAX_DISCOVERY_BUDGET_MINOR_UNITS,
  discoveryFilterKeys,
  parseDiscoverySearchParams,
  serializeDiscoveryFilters,
  type DiscoveryFilterValues,
} from "./discovery-query";

const maximumBudgetMajorUnits = (
  MAX_DISCOVERY_BUDGET_MINOR_UNITS / 100
).toFixed(2);

export type DiscoveryFilterCopy = Readonly<{
  apply: string;
  pending: string;
  specialty: string;
  allSpecialties: string;
  constructionRepair: string;
  city: string;
  budgetRange: string;
  minimumBudget: string;
  maximumBudget: string;
  deadlineBefore: string;
  deadlineHint: string;
  invalidInput: string;
  invalidBudgetRange: string;
  summaryOne: string;
  summaryMany: string;
}>;

function formValue(formData: FormData, key: keyof DiscoveryFilterValues) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function DiscoveryFilters({
  copy,
}: Readonly<{ copy: DiscoveryFilterCopy }>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const queryKey = searchParams.toString();
  const currentValues = Object.fromEntries(
    discoveryFilterKeys.map((key) => {
      const values = searchParams.getAll(key);
      return [key, values.length > 1 ? values : values[0]];
    }),
  );
  const parsed = parseDiscoverySearchParams(currentValues);
  const invalidFields = new Set(parsed.ok ? [] : parsed.fields);
  const budgetError =
    invalidFields.has("minBudget") || invalidFields.has("maxBudget")
      ? copy.invalidBudgetRange
      : undefined;
  const issues: FormIssue[] = [];
  if (invalidFields.has("specialty"))
    issues.push({ field: "specialty", message: copy.invalidInput });
  if (invalidFields.has("city"))
    issues.push({ field: "city", message: copy.invalidInput });
  if (budgetError) issues.push({ field: "minBudget", message: budgetError });
  if (invalidFields.has("deadlineBefore"))
    issues.push({ field: "deadlineBefore", message: copy.invalidInput });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const values: DiscoveryFilterValues = {
      specialty: formValue(formData, "specialty"),
      city: formValue(formData, "city"),
      minBudget: formValue(formData, "minBudget"),
      maxBudget: formValue(formData, "maxBudget"),
      deadlineBefore: formValue(formData, "deadlineBefore"),
    };
    const href = serializeDiscoveryFilters(pathname, searchParams, values);
    startTransition(() => router.push(href));
  }

  return (
    <form className="discovery-filters" key={queryKey} onSubmit={submit}>
      <ErrorSummary
        issues={issues}
        summaryOne={copy.summaryOne}
        summaryMany={copy.summaryMany}
        id="filter-errors"
      />
      <Field
        id="specialty"
        label={copy.specialty}
        error={invalidFields.has("specialty") ? copy.invalidInput : undefined}
      >
        <select
          name="specialty"
          defaultValue={searchParams.get("specialty") ?? ""}
        >
          <option value="">{copy.allSpecialties}</option>
          <option value="CONSTRUCTION_REPAIR">{copy.constructionRepair}</option>
        </select>
      </Field>
      <Field
        id="city"
        label={copy.city}
        error={invalidFields.has("city") ? copy.invalidInput : undefined}
      >
        <input
          name="city"
          type="text"
          defaultValue={searchParams.get("city") ?? ""}
          maxLength={120}
          autoComplete="address-level2"
        />
      </Field>
      <fieldset className="discovery-budget-group">
        <legend>{copy.budgetRange}</legend>
        <div className="discovery-budget-fields">
          <Field id="minBudget" label={copy.minimumBudget} error={budgetError}>
            <input
              name="minBudget"
              type="number"
              defaultValue={searchParams.get("minBudget") ?? ""}
              inputMode="decimal"
              min="0"
              max={maximumBudgetMajorUnits}
              step="0.01"
            />
          </Field>
          <Field id="maxBudget" label={copy.maximumBudget} error={budgetError}>
            <input
              name="maxBudget"
              type="number"
              defaultValue={searchParams.get("maxBudget") ?? ""}
              inputMode="decimal"
              min="0"
              max={maximumBudgetMajorUnits}
              step="0.01"
            />
          </Field>
        </div>
      </fieldset>
      <Field
        id="deadlineBefore"
        label={copy.deadlineBefore}
        description={copy.deadlineHint}
        error={
          invalidFields.has("deadlineBefore") ? copy.invalidInput : undefined
        }
      >
        <input
          name="deadlineBefore"
          type="date"
          defaultValue={searchParams.get("deadlineBefore") ?? ""}
        />
      </Field>
      <SubmitButton
        label={copy.apply}
        pendingLabel={copy.pending}
        isPending={isPending}
      />
    </form>
  );
}
