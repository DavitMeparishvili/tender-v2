"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import type { Locale } from "../../localization/config";

export type DatePickerCopy = Readonly<{
  previousMonth: string;
  nextMonth: string;
  today: string;
  clear: string;
  chooseDate: string;
  time: string;
}>;

type MonthCursor = Readonly<{ year: number; month: number }>;

type CalendarDay = Readonly<{
  year: number;
  month: number;
  day: number;
  key: string;
  inCurrentMonth: boolean;
  isToday: boolean;
}>;

const CALENDAR_CELL_COUNT = 42;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function shiftMonth(cursor: MonthCursor, delta: number): MonthCursor {
  const total = cursor.year * 12 + (cursor.month - 1) + delta;
  return { year: Math.floor(total / 12), month: (((total % 12) + 12) % 12) + 1 };
}

// Monday-first index (0 = Monday … 6 = Sunday) matches Georgian and European
// calendar convention, independent of the display locale.
function mondayFirstWeekday(year: number, month: number, day: number) {
  const jsWeekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (jsWeekday + 6) % 7;
}

function todayParts() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function parseDateKey(value: string): MonthCursor & { day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    const today = todayParts();
    return today;
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function buildCalendarGrid(cursor: MonthCursor, todayKey: string): CalendarDay[] {
  const firstWeekday = mondayFirstWeekday(cursor.year, cursor.month, 1);
  const totalDays = daysInMonth(cursor.year, cursor.month);
  const previous = shiftMonth(cursor, -1);
  const daysInPrevious = daysInMonth(previous.year, previous.month);
  const cells: CalendarDay[] = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    const day = daysInPrevious - firstWeekday + 1 + index;
    cells.push({
      year: previous.year,
      month: previous.month,
      day,
      key: dateKey(previous.year, previous.month, day),
      inCurrentMonth: false,
      isToday: false,
    });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const key = dateKey(cursor.year, cursor.month, day);
    cells.push({
      year: cursor.year,
      month: cursor.month,
      day,
      key,
      inCurrentMonth: true,
      isToday: key === todayKey,
    });
  }

  const next = shiftMonth(cursor, 1);
  let nextDay = 1;
  while (cells.length < CALENDAR_CELL_COUNT) {
    cells.push({
      year: next.year,
      month: next.month,
      day: nextDay,
      key: dateKey(next.year, next.month, nextDay),
      inCurrentMonth: false,
      isToday: false,
    });
    nextDay += 1;
  }

  return cells;
}

function intlLocale(locale: Locale) {
  return locale === "ka" ? "ka-GE" : "en-GB";
}

function formatDisplayDate(value: string, locale: Locale) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function monthLabel(cursor: MonthCursor, locale: Locale) {
  const date = new Date(Date.UTC(cursor.year, cursor.month - 1, 1));
  return new Intl.DateTimeFormat(intlLocale(locale), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function weekdayLabels(locale: Locale) {
  // 2024-01-01 is a Monday in UTC — a stable anchor for a Monday-first strip.
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(2024, 0, 1 + index));
    return new Intl.DateTimeFormat(intlLocale(locale), {
      weekday: "short",
      timeZone: "UTC",
    }).format(date);
  });
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="date-field-icon">
      <rect x="3" y="4.5" width="14" height="12" rx="2.25" />
      <path d="M3 8.25h14" />
      <path d="M6.75 2.75v3M13.25 2.75v3" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ direction }: Readonly<{ direction: "left" | "right" }>) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="date-field-chevron">
      <path
        d={direction === "left" ? "M12 4.5 6.5 10l5.5 5.5" : "M8 4.5 13.5 10 8 15.5"}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function useCalendarPopover(selectedValue: string, onSelect: (key: string) => void) {
  const [open, setOpen] = useState(false);
  const seed = selectedValue ? parseDateKey(selectedValue) : todayParts();
  const [cursor, setCursor] = useState<MonthCursor>({ year: seed.year, month: seed.month });
  const [focusedKey, setFocusedKey] = useState(dateKey(seed.year, seed.month, seed.day));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const focusPending = useRef(false);

  function openPopover() {
    const base = selectedValue ? parseDateKey(selectedValue) : todayParts();
    setCursor({ year: base.year, month: base.month });
    setFocusedKey(dateKey(base.year, base.month, base.day));
    setOpen(true);
  }

  function closePopover(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) {
      const trigger = containerRef.current?.querySelector<HTMLElement>(
        "[data-date-field-trigger]",
      );
      trigger?.focus();
    }
  }

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !focusPending.current) return;
    focusPending.current = false;
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-key="${focusedKey}"]`)
      ?.focus();
  }, [open, focusedKey, cursor]);

  function moveFocus(delta: number) {
    const parts = parseDateKey(focusedKey);
    const anchor = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + delta));
    const nextKey = dateKey(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, anchor.getUTCDate());
    setCursor({ year: anchor.getUTCFullYear(), month: anchor.getUTCMonth() + 1 });
    setFocusedKey(nextKey);
    focusPending.current = true;
  }

  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const stepByKey: Readonly<Record<string, number>> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const step = stepByKey[event.key];
    if (step !== undefined) {
      event.preventDefault();
      moveFocus(step);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(focusedKey);
      closePopover(true);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closePopover(true);
    }
  }

  return [
    open,
    cursor,
    focusedKey,
    containerRef,
    gridRef,
    openPopover,
    closePopover,
    setCursor,
    setFocusedKey,
    handleGridKeyDown,
  ] as const;
}

function CalendarPopover({
  cursor,
  focusedKey,
  selectedKey,
  todayKey,
  locale,
  copy,
  gridRef,
  onCursorChange,
  onFocusedKeyChange,
  onSelect,
  onKeyDown,
  onClear,
  showClear,
}: Readonly<{
  cursor: MonthCursor;
  focusedKey: string;
  selectedKey: string;
  todayKey: string;
  locale: Locale;
  copy: DatePickerCopy;
  gridRef: RefObject<HTMLDivElement | null>;
  onCursorChange: (cursor: MonthCursor) => void;
  onFocusedKeyChange: (key: string) => void;
  onSelect: (key: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onClear: () => void;
  showClear: boolean;
}>) {
  const cells = useMemo(() => buildCalendarGrid(cursor, todayKey), [cursor, todayKey]);
  const labels = useMemo(() => weekdayLabels(locale), [locale]);

  return (
    <div className="date-calendar" role="dialog" aria-label={copy.chooseDate}>
      <div className="date-calendar-header">
        <button
          type="button"
          className="date-calendar-nav"
          aria-label={copy.previousMonth}
          onClick={() => onCursorChange(shiftMonth(cursor, -1))}
        >
          <ChevronIcon direction="left" />
        </button>
        <span className="date-calendar-month" aria-live="polite">
          {monthLabel(cursor, locale)}
        </span>
        <button
          type="button"
          className="date-calendar-nav"
          aria-label={copy.nextMonth}
          onClick={() => onCursorChange(shiftMonth(cursor, 1))}
        >
          <ChevronIcon direction="right" />
        </button>
      </div>
      <div className="date-calendar-weekdays" aria-hidden="true">
        {labels.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
      <div
        className="date-calendar-grid"
        role="grid"
        ref={gridRef}
        onKeyDown={onKeyDown}
      >
        {cells.map((cell) => (
          <button
            type="button"
            key={cell.key}
            role="gridcell"
            data-key={cell.key}
            className="date-calendar-day"
            data-outside={cell.inCurrentMonth ? undefined : "true"}
            data-selected={cell.key === selectedKey ? "true" : undefined}
            data-today={cell.isToday ? "true" : undefined}
            tabIndex={cell.key === focusedKey ? 0 : -1}
            aria-selected={cell.key === selectedKey}
            aria-current={cell.isToday ? "date" : undefined}
            onFocus={() => onFocusedKeyChange(cell.key)}
            onClick={() => {
              if (!cell.inCurrentMonth) onCursorChange({ year: cell.year, month: cell.month });
              onSelect(cell.key);
            }}
          >
            {cell.day}
          </button>
        ))}
      </div>
      <div className="date-calendar-footer">
        <button
          type="button"
          className="date-calendar-today"
          onClick={() => {
            const today = todayParts();
            onCursorChange({ year: today.year, month: today.month });
            onSelect(dateKey(today.year, today.month, today.day));
          }}
        >
          {copy.today}
        </button>
        {showClear ? (
          <button type="button" className="date-calendar-clear" onClick={onClear}>
            {copy.clear}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export type DateFieldProps = Readonly<{
  id?: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  locale: Locale;
  copy: DatePickerCopy;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}>;

export function DateField({
  id,
  name,
  value,
  onChange,
  locale,
  copy,
  ...describedProps
}: DateFieldProps) {
  const [
    open,
    cursor,
    focusedKey,
    containerRef,
    gridRef,
    openPopover,
    closePopover,
    setCursor,
    setFocusedKey,
    handleGridKeyDown,
  ] = useCalendarPopover(value, onChange);
  const todayKey = useMemo(() => {
    const today = todayParts();
    return dateKey(today.year, today.month, today.day);
  }, []);

  return (
    <div className="date-field" ref={containerRef}>
      <button
        id={id}
        type="button"
        data-date-field-trigger
        className="date-field-trigger"
        data-placeholder={value ? undefined : "true"}
        data-invalid={describedProps["aria-invalid"] ? "true" : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={describedProps["aria-describedby"]}
        onClick={() => (open ? closePopover(false) : openPopover())}
      >
        <span>{value ? formatDisplayDate(value, locale) : copy.chooseDate}</span>
        <CalendarIcon />
      </button>
      <input type="hidden" name={name} value={value} readOnly />
      {open ? (
        <CalendarPopover
          cursor={cursor}
          focusedKey={focusedKey}
          selectedKey={value}
          todayKey={todayKey}
          locale={locale}
          copy={copy}
          gridRef={gridRef}
          onCursorChange={setCursor}
          onFocusedKeyChange={setFocusedKey}
          onSelect={(key) => {
            onChange(key);
            closePopover(true);
          }}
          onKeyDown={handleGridKeyDown}
          onClear={() => {
            onChange("");
            closePopover(true);
          }}
          showClear={value !== ""}
        />
      ) : null}
    </div>
  );
}

export type DateTimeFieldProps = Readonly<{
  id?: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  locale: Locale;
  copy: DatePickerCopy;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}>;

export function DateTimeField({
  id,
  name,
  value,
  onChange,
  locale,
  copy,
  required,
  ...describedProps
}: DateTimeFieldProps) {
  // Local state, not derived straight from `value`: the composed value only
  // ever reaches the parent once both a date and a time are picked, so if the
  // draft lived in `value` alone, choosing just the date would render as ""
  // and the trigger would immediately snap back to its placeholder.
  const initialParts = value.includes("T") ? value.split("T") : [value, ""];
  const [dateValue, setDateValue] = useState(initialParts[0] ?? "");
  const [timeValue, setTimeValue] = useState(initialParts[1] ?? "");

  function commit(nextDate: string, nextTime: string) {
    setDateValue(nextDate);
    setTimeValue(nextTime);
    onChange(nextDate && nextTime ? `${nextDate}T${nextTime}` : "");
  }

  const [
    open,
    cursor,
    focusedKey,
    containerRef,
    gridRef,
    openPopover,
    closePopover,
    setCursor,
    setFocusedKey,
    handleGridKeyDown,
  ] = useCalendarPopover(dateValue, (key) => commit(key, timeValue));
  const todayKey = useMemo(() => {
    const today = todayParts();
    return dateKey(today.year, today.month, today.day);
  }, []);

  return (
    <div className="date-field date-time-field">
      <div className="date-time-row" ref={containerRef}>
        <button
          id={id}
          type="button"
          data-date-field-trigger
          className="date-field-trigger"
          data-placeholder={dateValue ? undefined : "true"}
          data-invalid={describedProps["aria-invalid"] ? "true" : undefined}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-describedby={describedProps["aria-describedby"]}
          onClick={() => (open ? closePopover(false) : openPopover())}
        >
          <span>{dateValue ? formatDisplayDate(dateValue, locale) : copy.chooseDate}</span>
          <CalendarIcon />
        </button>
        <input
          type="time"
          className="date-time-input"
          aria-label={copy.time}
          aria-required={required}
          aria-invalid={describedProps["aria-invalid"]}
          step={60}
          value={timeValue}
          onChange={(event) => commit(dateValue, event.target.value)}
        />
        {open ? (
          <CalendarPopover
            cursor={cursor}
            focusedKey={focusedKey}
            selectedKey={dateValue}
            todayKey={todayKey}
            locale={locale}
            copy={copy}
            gridRef={gridRef}
            onCursorChange={setCursor}
            onFocusedKeyChange={setFocusedKey}
            onSelect={(key) => {
              commit(key, timeValue);
              closePopover(true);
            }}
            onKeyDown={handleGridKeyDown}
            onClear={() => {
              commit("", timeValue);
              closePopover(true);
            }}
            showClear={dateValue !== ""}
          />
        ) : null}
      </div>
      <input type="hidden" name={name} value={value} readOnly />
    </div>
  );
}
