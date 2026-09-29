"use client";

import { useLayoutEffect, useRef, type ChangeEvent } from "react";

const MAX_INTEGER_DIGITS = 8;
const MAX_FRACTION_DIGITS = 2;

export type AmountInputProps = Readonly<{
  id?: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}>;

// Keeps at most one decimal point and the digit counts majorUnitsToMinor
// accepts (\d{1,8} major, \d{1,2} minor), so a pasted or overtyped value can
// never drift out of what the parser downstream will consider valid.
function sanitizeAmount(input: string): string {
  let digitsAndDot = input.replace(/[^0-9.]/g, "");
  const firstDot = digitsAndDot.indexOf(".");
  if (firstDot !== -1) {
    digitsAndDot =
      digitsAndDot.slice(0, firstDot + 1) +
      digitsAndDot.slice(firstDot + 1).replace(/\./g, "");
  }
  const [integerPart, fractionPart] = digitsAndDot.split(".");
  const boundedInteger = (integerPart ?? "").slice(0, MAX_INTEGER_DIGITS);
  if (fractionPart === undefined) return boundedInteger;
  return `${boundedInteger}.${fractionPart.slice(0, MAX_FRACTION_DIGITS)}`;
}

function formatAmount(raw: string): string {
  if (raw === "") return "";
  const [integerPart, fractionPart] = raw.split(".");
  const grouped = (integerPart ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fractionPart === undefined ? grouped : `${grouped}.${fractionPart}`;
}

function charactersBeforeCursor(text: string, cursor: number): number {
  let count = 0;
  for (let index = 0; index < cursor && index < text.length; index += 1) {
    if (/[0-9.]/.test(text[index] ?? "")) count += 1;
  }
  return count;
}

function cursorAfterCharacters(text: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let count = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (/[0-9.]/.test(text[index] ?? "")) {
      count += 1;
      if (count === digitCount) return index + 1;
    }
  }
  return text.length;
}

// Renders the wizard's bare "12500.5"-style major-units string with
// thousands separators. The raw, unformatted string is what onChange
// reports and what majorUnitsToMinor/toUpdateCommand parse — this component
// only changes the presentation, never the stored value's shape.
export function AmountInput({ value, onChange, ...rest }: AmountInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingCursorCharacters = useRef<number | null>(null);
  const displayValue = formatAmount(value);

  useLayoutEffect(() => {
    const digits = pendingCursorCharacters.current;
    const input = inputRef.current;
    if (digits === null || input === null) return;
    pendingCursorCharacters.current = null;
    const cursor = cursorAfterCharacters(displayValue, digits);
    input.setSelectionRange(cursor, cursor);
  }, [displayValue]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const cursor = input.selectionStart ?? input.value.length;
    pendingCursorCharacters.current = charactersBeforeCursor(
      input.value,
      cursor,
    );
    onChange(sanitizeAmount(input.value));
  }

  return (
    <input
      {...rest}
      ref={inputRef}
      className="num"
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder="0"
      value={displayValue}
      onChange={handleChange}
    />
  );
}
