/**
 * Spectrum UI — MetalPromptBar
 *
 * An AI prompt bar whose send button wears a live liquid-metal ring painted by
 * `metal-fx` (Jakub Antalík, MIT, https://metal.jakubantalik.com): one row with
 * the auto-growing textarea, the microphone and the send button, Enter to send,
 * Shift+Enter for newlines, and a disabled (never hidden) send while empty.
 * Suggestions only show while the person types, matched against the text.
 *
 * Adapted to the Console's design tokens (card, border, foreground) and to its
 * appearance setting instead of `.dark` classes.
 *
 * Dependencies: metal-fx, lucide-react, @/lib/cn
 *
 * @example
 * <MetalPromptBar onSubmit={(text) => ask(text)} />
 */

"use client";

import * as React from "react";
import { MetalFx, type MetalFxPreset } from "metal-fx";
import { ArrowUp, ArrowUpRight, CornerDownLeft, Mic, Paperclip, Square, X } from "lucide-react";

import { cn } from "@/lib/cn";
import { useDictation, type DictationPhase } from "@/components/console/use-dictation";
import { caretOf, mayFocus, rangeFor, type Caret } from "@/components/console/insert-text";
import { joinTranscript } from "@/lib/voice/voice-rules";
import {
  useSurfaceTheme,
  type SurfaceTheme,
} from "@/components/ui/metal-prompt-bar-utils/use-surface-theme";

/** Something offered while typing: a question to send, or a place to go. */
export type PromptSuggestion = { label: string; kind: "ask" | "go"; onSelect: () => void };

export interface MetalPromptBarProps {
  /** Placeholder for the empty composer. Default "Pergunte ou peça algo…" */
  placeholder?: string;
  /** Offered while typing, filtered by what is in the field (up to 4). Default [] */
  suggestions?: PromptSuggestion[];
  /** Metal palette for the send ring. Default "chromatic" */
  preset?: MetalFxPreset;
  /** "auto" follows the Console's appearance setting, then the OS. Default "auto" */
  theme?: SurfaceTheme;
  /** Fires with the trimmed text on Enter or the send button; the field clears afterwards */
  onSubmit?: (text: string) => void;
  /** Shows the attach button. Default false */
  attach?: boolean;
  /** Blocks sending while the previous message is being answered */
  busy?: boolean;
  /** Focus the composer when it mounts */
  autoFocus?: boolean;
  /** Max textarea rows before it scrolls. Default 6 */
  maxRows?: number;
  /** Shows the microphone: dictated text lands in the field, never sent on its own. Default false */
  dictation?: boolean;
  /** Longest message the composer takes; dictated text is cut to fit. Default 20000 */
  maxLength?: number;
  /** Fires on each step of the microphone, and with "idle" when the composer goes away */
  onDictationChange?: (phase: DictationPhase) => void;
  className?: string;
}

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Suggestions whose label holds every word typed (accents and case ignored). */
function matching(suggestions: PromptSuggestion[], text: string) {
  const words = fold(text).split(/\s+/).filter((w) => w.length >= 2);
  if (!words.length) return [];
  return suggestions.filter((s) => words.every((w) => fold(s.label).includes(w))).slice(0, 4);
}

/** Each bar's share of the voice level, so the dots move like a waveform and not in unison. */
const BARS = [0.55, 0.9, 0.7, 1, 0.65, 0.85];

export function MetalPromptBar({
  placeholder = "Pergunte ou peça algo…",
  suggestions = [],
  preset = "chromatic",
  theme = "auto",
  onSubmit,
  attach = false,
  busy = false,
  autoFocus = false,
  maxRows = 6,
  dictation = false,
  maxLength = 20000,
  onDictationChange,
  className,
}: MetalPromptBarProps) {
  const resolved = useSurfaceTheme(theme);
  const [text, setText] = React.useState("");
  const [active, setActive] = React.useState(-1);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const listId = React.useId();

  const resize = (el: HTMLTextAreaElement) => {
    el.style.height = "0px";
    const line = parseFloat(getComputedStyle(el).lineHeight) || 24;
    el.style.height = `${Math.min(el.scrollHeight, line * maxRows)}px`;
  };

  // Where dictated text goes: the cursor of the tap (caught on pointerdown, before the focus leaves the field).
  const rootRef = React.useRef<HTMLDivElement>(null);
  const micRef = React.useRef<HTMLButtonElement>(null);
  const tapped = React.useRef<Caret>(null);
  const caret = React.useRef<Caret>(null);
  const dictate = useDictation((spoken) => {
    const el = textareaRef.current;
    if (!el) return;
    const [start, end] = rangeFor(el, caret.current);
    const result = joinTranscript(el.value, start, end, spoken, maxLength);
    const focus = mayFocus(el, rootRef.current);
    setText(result.value);
    requestAnimationFrame(() => {
      resize(el);
      if (!focus) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(result.caret, result.caret);
    });
    if (result.truncated) return "A mensagem passou do limite e o texto ditado foi cortado. Revise antes de enviar.";
  });
  React.useEffect(() => onDictationChange?.(dictate.phase), [dictate.phase, onDictationChange]);
  React.useEffect(() => () => onDictationChange?.("idle"), [onDictationChange]);
  const mic = dictation && dictate.supported;
  const recording = dictate.phase === "recording";
  // While the microphone is open or the text is coming back, nothing is sent.
  const canSend = text.trim().length > 0 && !busy && !dictate.busy;
  const offered = busy || dictate.busy ? [] : matching(suggestions, text);
  const current = active < offered.length ? active : -1;

  const clear = () => {
    setText("");
    setActive(-1);
    const el = textareaRef.current;
    if (el) {
      el.value = "";
      resize(el);
    }
  };
  const submit = () => {
    if (!canSend) return;
    onSubmit?.(text.trim());
    clear();
    dictate.dismiss();
  };
  const pick = (suggestion: PromptSuggestion) => {
    clear();
    suggestion.onSelect();
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        "w-full rounded-[22px] border bg-card p-2 pl-3 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.12)]",
        className,
      )}
    >
      {offered.length > 0 && (
        <ul id={listId} role="listbox" aria-label="Sugestões" className="m-0 mb-1.5 list-none border-b p-0 pb-1.5">
          {offered.map((s, index) => (
            <li key={s.label} role="none">
              <button
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={index === current}
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(s)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary aria-selected:bg-secondary"
              >
                {s.kind === "go" ? (
                  <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <CornerDownLeft aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 truncate">{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-2">
        {attach && (
          <button
            type="button"
            aria-label="Anexar"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
          >
            <Paperclip className="size-4" />
          </button>
        )}
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          placeholder={placeholder}
          aria-label="Mensagem para o assistente"
          role={suggestions.length ? "combobox" : undefined}
          aria-expanded={suggestions.length ? offered.length > 0 : undefined}
          aria-controls={offered.length ? listId : undefined}
          aria-autocomplete={suggestions.length ? "list" : undefined}
          aria-activedescendant={current >= 0 ? `${listId}-${current}` : undefined}
          autoFocus={autoFocus}
          onChange={(event) => {
            setText(event.target.value);
            setActive(-1);
            resize(event.target);
          }}
          onKeyDown={(event) => {
            if (offered.length && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
              event.preventDefault();
              // Cycles through "none" (-1) and each suggestion, so the arrows can always go back to the text.
              const slots = offered.length + 1;
              const step = event.key === "ArrowDown" ? 1 : -1;
              setActive(((current + 1 + step + slots) % slots) - 1);
              return;
            }
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (current >= 0) return pick(offered[current]);
              submit();
            }
          }}
          className="block min-h-9 min-w-0 flex-1 resize-none self-center border-0 bg-transparent py-1.5 text-[15px] leading-6 text-foreground shadow-none outline-hidden placeholder:text-muted-foreground focus:ring-0"
        />
        {mic &&
          (dictate.busy ? (
            <div className="flex h-9 shrink-0 items-center gap-0.5">
              {/* Discards the recording: nothing is transcribed. Esc does the same. */}
              <button
                type="button"
                aria-label="Descartar gravação"
                onClick={dictate.cancel}
                className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
              <div
                className={cn(
                  "flex h-9 items-center gap-2 rounded-full border bg-secondary pr-1 pl-3.5",
                  dictate.ending && "border-destructive/40",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("flex h-3 items-center gap-[3px]", dictate.ending ? "text-destructive" : "text-muted-foreground")}
                >
                  {BARS.map((share, index) => (
                    <span
                      key={index}
                      className={cn(
                        "h-[3px] w-[3px] rounded-full bg-current",
                        recording ? "motion-safe:transition-transform motion-safe:duration-100" : "motion-safe:animate-pulse",
                      )}
                      style={
                        recording
                          ? { transform: `scaleY(${1 + dictate.level * share * 3})` }
                          : { animationDelay: `${index * 120}ms` }
                      }
                    />
                  ))}
                </span>
                <button
                  ref={micRef}
                  type="button"
                  aria-label={recording ? "Parar e transcrever" : dictate.phase === "starting" ? "Abrindo o microfone" : "Transcrevendo"}
                  // Not `disabled`: a disabled button drops the focus.
                  aria-disabled={!recording || undefined}
                  onClick={() => {
                    if (recording) dictate.stop();
                  }}
                  className="flex size-7 items-center justify-center rounded-full text-foreground transition-colors hover:bg-background aria-disabled:cursor-wait aria-disabled:opacity-40"
                >
                  <Square className="size-3 fill-current" />
                </button>
              </div>
            </div>
          ) : (
            <button
              ref={micRef}
              type="button"
              aria-label="Falar"
              onPointerDown={() => {
                tapped.current = caretOf(textareaRef.current);
              }}
              onClick={() => {
                caret.current = tapped.current ?? caretOf(textareaRef.current);
                tapped.current = null;
                dictate.start();
              }}
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Mic className="size-[18px]" />
            </button>
          ))}
        <MetalFx
          variant="circle"
          preset={preset}
          theme={resolved}
          className={cn("inline-flex size-9 shrink-0 items-center justify-center", !canSend && "opacity-60")}
        >
          <button
            type="button"
            aria-label="Enviar"
            disabled={!canSend}
            onClick={submit}
            className="flex size-9 items-center justify-center rounded-full text-foreground transition-transform active:scale-95 disabled:cursor-not-allowed"
          >
            <ArrowUp className="size-4" />
          </button>
        </MetalFx>
      </div>
      {mic && (
        <>
          {/* What happens to the microphone, for screen readers; the pill above already shows it. */}
          <span role="status" aria-live="polite" className="sr-only">
            {dictate.notice}
          </span>
          {dictate.phase === "error" && (
            <div className="flex items-center gap-2 px-1 pt-1.5">
              <p className="m-0 min-w-0 flex-1 text-xs text-destructive">{dictate.notice}</p>
              {dictate.canRetry && (
                <button
                  type="button"
                  onClick={() => {
                    dictate.retry();
                    micRef.current?.focus();
                  }}
                  className="h-7 shrink-0 rounded-full border px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  Tentar de novo
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default MetalPromptBar;
