/**
 * Spectrum UI — MetalPromptBar
 *
 * An AI prompt bar whose send button wears a live liquid-metal ring painted by
 * `metal-fx` (Jakub Antalík, MIT, https://metal.jakubantalik.com). The chips
 * beside it are passed to MetalFx as reflection targets, so in dark mode they
 * pick up a soft mirrored glint of the ring: auto-growing textarea, Enter to
 * send, Shift+Enter for newlines, and a disabled send state while empty.
 *
 * Adapted to the Console's design tokens (card, border, foreground) and to its
 * appearance setting instead of `.dark` classes.
 *
 * Dependencies: metal-fx, lucide-react, @/lib/utils
 *
 * @example
 * <MetalPromptBar onSubmit={(text) => ask(text)} />
 */

"use client";

import * as React from "react";
import { MetalFx, type MetalFxPreset } from "metal-fx";
import { ArrowUp, Loader2, Mic, Paperclip, Square, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useDictation } from "@/components/console/use-dictation";
import { caretOf, mayFocus, rangeFor, type Caret } from "@/components/console/insert-text";
import { clockLabel, joinTranscript, PRIVACY_LINE } from "@/lib/voice/voice-rules";
import {
  useSurfaceTheme,
  type SurfaceTheme,
} from "@/components/ui/metal-prompt-bar-utils/use-surface-theme";

export interface MetalPromptBarProps {
  /** Placeholder for the empty composer. Default "Pergunte ou peça algo…" */
  placeholder?: string;
  /** Pills shown bottom-left; each one reflects the metal ring in dark mode. Default [] */
  chips?: string[];
  /** Metal palette for the send ring. Default "chromatic" */
  preset?: MetalFxPreset;
  /** "auto" follows the Console's appearance setting, then the OS. Default "auto" */
  theme?: SurfaceTheme;
  /** Fires with the trimmed text on Enter or the send button; the field clears afterwards */
  onSubmit?: (text: string) => void;
  /** Fires when a chip is clicked */
  onChipClick?: (chip: string) => void;
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
  className?: string;
}

export function MetalPromptBar({
  placeholder = "Pergunte ou peça algo…",
  chips = [],
  preset = "chromatic",
  theme = "auto",
  onSubmit,
  onChipClick,
  attach = false,
  busy = false,
  autoFocus = false,
  maxRows = 6,
  dictation = false,
  maxLength = 20000,
  className,
}: MetalPromptBarProps) {
  const resolved = useSurfaceTheme(theme);
  const [text, setText] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  // Stable refs per chip so MetalFx can paint reflections onto them
  const chipRefs = React.useMemo(
    () => chips.map(() => React.createRef<HTMLButtonElement>()),
    [chips],
  );

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
  const mic = dictation && dictate.supported;
  const recording = dictate.phase === "recording";
  // While the microphone is open or the text is coming back, nothing is sent.
  const canSend = text.trim().length > 0 && !busy && !dictate.busy;

  const submit = () => {
    if (!canSend) return;
    onSubmit?.(text.trim());
    setText("");
    dictate.dismiss();
    const el = textareaRef.current;
    if (el) {
      el.value = "";
      resize(el);
    }
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        "w-full rounded-[22px] border bg-card p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.12)]",
        className,
      )}
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        placeholder={placeholder}
        aria-label="Mensagem para o assistente"
        autoFocus={autoFocus}
        onChange={(event) => {
          setText(event.target.value);
          resize(event.target);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            submit();
          }
        }}
        className="block w-full resize-none border-0 bg-transparent px-1 pt-1 text-[15px] leading-6 text-foreground shadow-none outline-hidden placeholder:text-muted-foreground focus:ring-0"
      />
      <div className="mt-2 flex items-center gap-2">
        {attach && (
          <button
            type="button"
            aria-label="Anexar"
            className="flex size-9 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:bg-accent"
          >
            <Paperclip className="size-4" />
          </button>
        )}
        {mic && dictate.busy ? (
          <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full bg-secondary px-3.5 text-[13px] text-foreground">
            {recording ? (
              <>
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full bg-destructive motion-safe:animate-pulse motion-safe:[transform:scale(var(--level))]"
                  style={{ "--level": 1 + dictate.level * 0.8 } as React.CSSProperties}
                />
                <span className="truncate">Gravando</span>
                <span className="tabular-nums text-muted-foreground">{clockLabel(dictate.seconds)}</span>
              </>
            ) : (
              <span className="truncate text-muted-foreground">
                {dictate.phase === "starting" ? "Abrindo o microfone…" : "Transcrevendo…"}
              </span>
            )}
            <button
              type="button"
              aria-label="Cancelar gravação"
              onClick={dictate.cancel}
              className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none]">
          {chips.map((chip, index) => (
            <button
              key={chip}
              ref={chipRefs[index]}
              type="button"
              onClick={() => onChipClick?.(chip)}
              className="h-9 shrink-0 rounded-full border bg-card px-3.5 text-[13px] font-medium whitespace-nowrap text-foreground transition-colors hover:bg-accent"
            >
              {chip}
            </button>
          ))}
        </div>
        )}
        {mic && (
          <button
            ref={micRef}
            type="button"
            aria-label={
              recording ? "Parar e transcrever" : dictate.phase === "starting" ? "Abrindo o microfone" : dictate.busy ? "Transcrevendo" : "Falar"
            }
            // Not `disabled`: a disabled button drops the focus.
            aria-disabled={(dictate.busy && !recording) || undefined}
            onPointerDown={() => {
              if (!dictate.busy) tapped.current = caretOf(textareaRef.current);
            }}
            onClick={() => {
              if (recording) return dictate.stop();
              if (dictate.busy) return;
              caret.current = tapped.current ?? caretOf(textareaRef.current);
              tapped.current = null;
              dictate.start();
            }}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:bg-accent aria-disabled:cursor-wait",
              recording && "border-destructive/40 text-destructive",
            )}
          >
            {recording ? (
              <Square className="size-3.5 fill-current" />
            ) : dictate.busy ? (
              <Loader2 className="size-4 motion-safe:animate-spin" />
            ) : (
              <Mic className="size-4" />
            )}
          </button>
        )}
        <MetalFx
          variant="circle"
          preset={preset}
          theme={resolved}
          reflectionTargets={chipRefs}
          className={cn("inline-flex shrink-0", !canSend && "opacity-70")}
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
        <div className="flex items-start gap-2 px-1">
          <span role="status" aria-live="polite" className="sr-only">
            {dictate.notice}
          </span>
          {/* The strip above already says "Gravando"; below it, where the audio goes, or how it ended. */}
          <p
            aria-hidden="true"
            className={cn("m-0 mt-2 min-w-0 flex-1 text-xs text-muted-foreground empty:hidden", dictate.phase === "error" && "text-destructive")}
          >
            {dictate.ending ? <span className="text-destructive">Faltam 10 segundos.</span> : dictate.busy ? PRIVACY_LINE : dictate.notice}
          </p>
          {dictate.canRetry && (
            <button
              type="button"
              onClick={() => {
                dictate.retry();
                micRef.current?.focus();
              }}
              className="mt-1.5 h-7 shrink-0 rounded-full border px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              Tentar de novo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default MetalPromptBar;
