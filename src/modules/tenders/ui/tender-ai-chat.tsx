"use client";

import Link from "next/link";
import {
  Fragment,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { FormEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  chatScript,
  type AnswerSegment,
  type ChatAnswer,
  type SourceKey,
  type TenderAiContext,
  type TenderAiCopy,
} from "./tender-ai-answers";
import { TenderIcon } from "./tender-icon";
import { EXIT_MS, useBottomSheet, useIsSheetLayout } from "./use-bottom-sheet";

type ChatMessage = Readonly<
  | { id: number; role: "user"; text: string }
  | { id: number; role: "ai"; answer: ChatAnswer }
>;

const THINKING_MS = 1000;
const WORD_MS = 45;
const HIGHLIGHT_MS = 1200;
// Page sections a source tag scrolls to; the first one present wins.
const SOURCE_TARGETS: Readonly<Record<SourceKey, readonly string[]>> = {
  budget: [".tender-fact-budget"],
  scope: ["#quantities", "#overview"],
  competition: [
    ".tender-competition",
    "[aria-labelledby='bid-summary-heading']",
  ],
};
const SOURCE_KEYS = Object.keys(SOURCE_TARGETS) as SourceKey[];
const noSubscription = () => () => {};

// A "word" keeps its trailing whitespace, so typing preserves spacing.
function words(text: string) {
  return text.split(/(?<=\s)/);
}

function answerSegments(answer: ChatAnswer) {
  return answer.blocks.flatMap((block) =>
    block.kind === "paragraph" ? block.segments : block.items.flat(),
  );
}

function countWords(answer: ChatAnswer) {
  return answerSegments(answer).reduce(
    (total, segment) => total + words(segment.text).length,
    0,
  );
}

/** Renders an answer, cut after `limit` words while it is being typed. */
function renderAnswer(answer: ChatAnswer, limit = Infinity): ReactNode[] {
  let left = limit;
  const inline = (segments: readonly AnswerSegment[]) => {
    const children: ReactNode[] = [];
    segments.forEach((segment, index) => {
      if (left <= 0) return;
      const parts = words(segment.text);
      const shown = parts.slice(0, left).join("");
      left -= parts.length;
      const text = segment.strong ? <strong>{shown}</strong> : shown;
      children.push(
        segment.href ? (
          <Link key={index} href={segment.href}>
            {text}
          </Link>
        ) : (
          <Fragment key={index}>{text}</Fragment>
        ),
      );
    });
    return children;
  };
  return answer.blocks.flatMap((block, index) => {
    if (block.kind === "paragraph") {
      const children = inline(block.segments);
      return children.length === 0 ? [] : [<p key={index}>{children}</p>];
    }
    const items = block.items
      .map((item) => inline(item))
      .filter((children) => children.length > 0);
    return items.length === 0
      ? []
      : [
          <ul key={index} className="tender-ai-list">
            {items.map((children, item) => (
              <li key={item}>{children}</li>
            ))}
          </ul>,
        ];
  });
}

function findSource(key: SourceKey) {
  for (const selector of SOURCE_TARGETS[key]) {
    const target = document.querySelector<HTMLElement>(selector);
    if (target) return target;
  }
  return null;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function highlight(target: HTMLElement) {
  target.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "center",
  });
  target.classList.remove("tender-ai-highlight");
  // Restart the pulse when the same source is clicked twice in a row.
  void target.offsetWidth;
  target.classList.add("tender-ai-highlight");
  window.setTimeout(
    () => target.classList.remove("tender-ai-highlight"),
    HIGHLIGHT_MS,
  );
}

export function TenderAiChat({
  copy,
  context,
}: Readonly<{ copy: TenderAiCopy; context: TenderAiContext }>) {
  // Portalled to <body> once on the client, so no page stacking context
  // (sticky rails, the location map) can paint over the chat.
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const sheetLayout = useIsSheetLayout();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [typing, setTyping] = useState<Readonly<{
    answer: ChatAnswer;
    words: number;
  }> | null>(null);
  const [draft, setDraft] = useState("");
  const [linkedSources, setLinkedSources] = useState<readonly SourceKey[]>([]);
  const timers = useRef<number[]>([]);
  const nextId = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pending = useRef<ChatAnswer | null>(null);
  const returnFocus = useRef(false);
  const headingId = useId();
  const inputId = useId();
  const panelId = useId();
  const busy = thinking || typing !== null;
  const script = chatScript(copy, context);
  const sourceLabels: Readonly<Record<SourceKey, string>> = {
    budget: copy.tender.sourceBudget,
    scope: copy.tender.sourceScope,
    competition: copy.tender.sourceCompetition,
  };

  const clearTimers = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  // On phones focus the sheet itself: focusing the input would pop the
  // on-screen keyboard over the suggestions as soon as the chat opens.
  useEffect(() => {
    if (open) {
      if (sheetLayout) panel.current?.focus();
      else input.current?.focus();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      launcher.current?.focus();
    }
  }, [open, sheetLayout]);

  // Follow the newest question up as its answer grows, until it reaches the
  // top, so the answer reads from its start; never scroll past it.
  useEffect(() => {
    const area = log.current;
    const questions = area?.querySelectorAll(".tender-ai-question");
    const question = questions?.[questions.length - 1];
    if (!area || !question) return;
    const offset =
      question.getBoundingClientRect().top - area.getBoundingClientRect().top;
    if (offset > 16) area.scrollTo({ top: area.scrollTop + offset - 16 });
  }, [open, messages, thinking, typing]);

  const addMessage = (
    message:
      | Readonly<{ role: "user"; text: string }>
      | Readonly<{ role: "ai"; answer: ChatAnswer }>,
  ) => {
    nextId.current += 1;
    const entry = { ...message, id: nextId.current };
    setMessages((current) => [...current, entry]);
  };

  const finishAnswer = () => {
    clearTimers();
    setThinking(false);
    setTyping(null);
    if (pending.current) addMessage({ role: "ai", answer: pending.current });
    pending.current = null;
  };

  const ask = (question: string, answer: ChatAnswer) => {
    const text = question.trim();
    if (text === "" || busy) return;
    addMessage({ role: "user", text });
    setDraft("");
    if (!sheetLayout) input.current?.focus();
    setThinking(true);
    pending.current = answer;
    const reduceMotion = prefersReducedMotion();
    timers.current.push(
      window.setTimeout(() => {
        setThinking(false);
        if (reduceMotion) {
          finishAnswer();
          return;
        }
        const total = countWords(answer);
        for (let count = 1; count <= total; count += 1) {
          timers.current.push(
            window.setTimeout(
              () =>
                count === total
                  ? finishAnswer()
                  : setTyping({ answer, words: count }),
              (count - 1) * WORD_MS,
            ),
          );
        }
      }, THINKING_MS),
    );
  };

  const openChat = () => {
    setLinkedSources(SOURCE_KEYS.filter((key) => findSource(key) !== null));
    setOpen(true);
  };

  const sheet = useBottomSheet({
    active: open && sheetLayout,
    panel,
    onDismissed: () => {
      returnFocus.current = true;
      setOpen(false);
    },
  });

  const close = () => {
    // Closing mid-answer skips to the full answer rather than leaving it stuck.
    if (busy) finishAnswer();
    sheet.dismiss();
  };

  const showSource = (key: SourceKey) => {
    const target = findSource(key);
    if (!target) return;
    const chat = panel.current?.getBoundingClientRect();
    const box = target.getBoundingClientRect();
    const covered =
      sheetLayout ||
      (chat !== undefined && box.left < chat.right && box.right > chat.left);
    if (!covered) {
      highlight(target);
      return;
    }
    // The sheet (or, on desktop, the dock over the right rail) would hide
    // the section: close the chat first, then scroll.
    close();
    window.setTimeout(() => highlight(target), EXIT_MS + 50);
  };

  // Listen on the document: a clicked chip is disabled while the answer runs,
  // which drops focus to <body>, outside the panel.
  const onEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") close();
  });
  useEffect(() => {
    if (!open) return;
    const listener = (event: KeyboardEvent) => onEscape(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [open]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    ask(draft, script.mainAnswer);
  };

  if (!hydrated) return null;

  // On desktop the launcher stays in the corner and becomes the close
  // button (Intercom-style); on phones the sheet replaces it.
  const launcherButton =
    open && sheetLayout ? null : (
      <button
        ref={launcher}
        type="button"
        className={`tender-ai-launcher${open ? " is-open" : ""}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? copy.close : undefined}
        onClick={open ? close : openChat}
      >
        {open ? (
          <TenderIcon name="chevron" size={22} />
        ) : (
          <>
            <TenderIcon name="sparkle" size={18} />
            <span className="tender-ai-launcher-label">{copy.launcher}</span>
          </>
        )}
      </button>
    );

  if (!open) return createPortal(launcherButton, document.body);

  const sources = (answer: ChatAnswer) =>
    answer.sources?.length ? (
      <ul className="tender-ai-sources">
        {answer.sources.map((key) => (
          <li key={key}>
            {linkedSources.includes(key) ? (
              <button type="button" onClick={() => showSource(key)}>
                {sourceLabels[key]}
              </button>
            ) : (
              <span>{sourceLabels[key]}</span>
            )}
          </li>
        ))}
      </ul>
    ) : null;

  return createPortal(
    <>
      {sheetLayout ? (
        <div
          className={`tender-ai-scrim${sheet.closing ? " is-closing" : ""}`}
          aria-hidden="true"
          onClick={close}
        />
      ) : null}
      <div
        ref={panel}
        id={panelId}
        role="dialog"
        aria-modal={sheetLayout || undefined}
        aria-labelledby={headingId}
        tabIndex={-1}
        className={`tender-ai-panel${sheet.closing ? " is-closing" : ""}`}
      >
        <div className="tender-ai-grab" {...sheet.dragHandlers}>
          <span className="tender-ai-handle" aria-hidden="true" />
          <div className="tender-ai-header">
            <span className="tender-ai-mark">
              <TenderIcon name="sparkle" size={16} />
            </span>
            <div className="tender-ai-heading">
              <h2 id={headingId}>{copy.title}</h2>
              <p>{copy.subtitle}</p>
            </div>
            <button
              type="button"
              className="tender-ai-icon-button"
              aria-label={copy.close}
              onClick={close}
            >
              <TenderIcon name="close" size={18} />
            </button>
          </div>
        </div>

        <div className="tender-ai-context">
          <TenderIcon
            name={context.kind === "home" ? "search" : "document"}
            size={18}
          />
          <div className="tender-ai-context-text">
            {script.contextTitle === script.contextLabel ? null : (
              <span>{script.contextLabel}</span>
            )}
            <strong>{script.contextTitle}</strong>
          </div>
          {script.contextDetail === null ? null : (
            <span className="tender-ai-context-budget">
              {script.contextDetail}
            </span>
          )}
        </div>

        <div ref={log} className="tender-ai-log">
          <div
            className="tender-ai-messages"
            aria-live="polite"
            aria-busy={busy}
          >
            {messages.map((message) =>
              message.role === "user" ? (
                <p key={message.id} className="tender-ai-question">
                  {message.text}
                </p>
              ) : (
                <div key={message.id} className="tender-ai-answer">
                  {renderAnswer(message.answer)}
                  {sources(message.answer)}
                </div>
              ),
            )}
            {thinking ? (
              <p className="tender-ai-thinking" role="status">
                <span aria-hidden="true" />
                <span aria-hidden="true" />
                <span aria-hidden="true" />
                <span className="sr-only">{copy.thinking}</span>
              </p>
            ) : null}
            {typing !== null ? (
              <div className="tender-ai-answer">
                {renderAnswer(typing.answer, typing.words)}
              </div>
            ) : null}
          </div>
          <ul
            className="tender-ai-suggestions"
            aria-label={copy.suggestionsLabel}
          >
            {script.suggestions.map((suggestion) => (
              <li key={suggestion.label}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => ask(suggestion.label, suggestion.answer)}
                >
                  {suggestion.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <form className="tender-ai-compose" onSubmit={submit}>
          <div className="tender-ai-field">
            <label className="sr-only" htmlFor={inputId}>
              {copy.inputLabel}
            </label>
            <input
              ref={input}
              id={inputId}
              type="text"
              autoComplete="off"
              placeholder={script.placeholder}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button
              type="submit"
              className="tender-ai-send"
              aria-label={copy.send}
              disabled={busy || draft.trim() === ""}
            >
              <TenderIcon name="arrow" size={18} />
            </button>
          </div>
          <p>{copy.disclaimer}</p>
        </form>
      </div>
      {launcherButton}
    </>,
    document.body,
  );
}
