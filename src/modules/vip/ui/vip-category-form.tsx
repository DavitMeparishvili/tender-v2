"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { Field } from "../../identity/ui/field";
import type { Locale } from "../../localization/config";
import { isVipSpecialty } from "../domain/partner";
import { partnersPath } from "../domain/partners-page";

export type CategoryFormOption = Readonly<{
  /** "" is All categories. */
  value: string;
  label: string;
  disabled: boolean;
}>;

/** A choice made from the keyboard that has not been committed yet. */
type PendingChoice = Readonly<{ base: string; value: string }>;

const KEYBOARD_STEP_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

/**
 * The service-category dropdown, shaped like the Discover tenders select. It is
 * a GET form, so it works without JavaScript through the submit button.
 *
 * With JavaScript:
 * - a change that is not an arrow-key step (a mouse or touch pick, a native
 *   menu confirmed with Enter, a screen reader) navigates at once;
 * - an arrow-key step on the closed select only moves the visible value. Enter
 *   on the select commits it, and so does a change that is not a step.
 *
 * Blur never commits, so a click on another link cannot race a navigation. A
 * pending choice simply goes away when `selected` changes (Clear, Back) or when
 * a page is restored from the back/forward cache.
 */
export function VipCategoryForm({
  locale,
  selected,
  options,
  fieldLabel,
  applyLabel,
}: Readonly<{
  locale: Locale;
  selected: string;
  options: readonly CategoryFormOption[];
  fieldLabel: string;
  applyLabel: string;
}>) {
  const formRef = useRef<HTMLFormElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const [pending, setPending] = useState<PendingChoice | null>(null);
  // True from an arrow-key keydown until the next macrotask. A change event in
  // that window came from a keyboard step on the closed select.
  const keyStepRef = useRef(false);
  // Set once a commit has started, so a second change cannot navigate again.
  const navigatingRef = useRef(false);

  useEffect(() => {
    formRef.current?.classList.add("is-enhanced");
  }, []);

  // A page restored from the back/forward cache keeps the DOM as it was when
  // the user left. The dropdown goes back to the URL's category here.
  useEffect(() => {
    function resync(event: PageTransitionEvent) {
      if (!event.persisted) return;
      navigatingRef.current = false;
      setPending(null);
      if (selectRef.current !== null) selectRef.current.value = selected;
    }
    window.addEventListener("pageshow", resync);
    return () => window.removeEventListener("pageshow", resync);
  }, [selected]);

  const shown =
    pending !== null && pending.base === selected ? pending.value : selected;

  function commit(value: string) {
    if (navigatingRef.current) return;
    if (value === selected) {
      setPending(null);
      return;
    }
    navigatingRef.current = true;
    // Keep the chosen value on screen until the browser has navigated.
    setPending({ base: selected, value });
    // The clean URL for All has no empty ?specialty= parameter.
    const specialty = isVipSpecialty(value) ? value : null;
    window.location.assign(partnersPath(locale, specialty));
  }

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    if (keyStepRef.current) {
      setPending({ base: selected, value });
      return;
    }
    commit(value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLSelectElement>) {
    if (KEYBOARD_STEP_KEYS.has(event.key)) {
      keyStepRef.current = true;
      setTimeout(() => {
        keyStepRef.current = false;
      }, 0);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (pending !== null && pending.base === selected) {
        commit(pending.value);
      }
    }
  }

  return (
    <form
      action={`/${locale}/partners`}
      autoComplete="off"
      className="vip-filter-form"
      method="get"
      ref={formRef}
    >
      <Field id="vip-specialty" label={fieldLabel}>
        {/* Controlled by `shown`, so the select follows the arrow keys while a
            keyboard step is pending, and follows the URL otherwise. */}
        <select
          autoComplete="off"
          className="vip-filter-select"
          name="specialty"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          ref={selectRef}
          value={shown}
        >
          {options.map((option) => (
            <option
              disabled={option.disabled}
              key={option.value === "" ? "all" : option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>
      </Field>
      <button className="button button-primary vip-filter-submit" type="submit">
        {applyLabel}
      </button>
    </form>
  );
}
