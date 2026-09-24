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
import { ArrowUp, Paperclip } from "lucide-react";

import { cn } from "@/lib/utils";
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
  const canSend = text.trim().length > 0 && !busy;

  const resize = (el: HTMLTextAreaElement) => {
    el.style.height = "0px";
    const line = parseFloat(getComputedStyle(el).lineHeight) || 24;
    el.style.height = `${Math.min(el.scrollHeight, line * maxRows)}px`;
  };

  const submit = () => {
    if (!canSend) return;
    onSubmit?.(text.trim());
    setText("");
    const el = textareaRef.current;
    if (el) {
      el.value = "";
      resize(el);
    }
  };

  return (
    <div
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
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">Enter envia</span>
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
    </div>
  );
}

export default MetalPromptBar;
