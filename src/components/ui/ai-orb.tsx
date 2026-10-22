"use client";

import { cn } from "@/lib/cn";
import { type ComponentProps, useEffect, useState } from "react";
import { AI_ORB_LABELS, type AiOrbState } from "./ai-orb-states";
import { BrandMark, type BrandMarkMode } from "./brand-mark";

export type { AiOrbState } from "./ai-orb-states";

// ---------------------------------------------------------------- states

/** Tint of the mark, always a theme token. */
export type AiOrbTone = "muted" | "primary" | "attention" | "critical";

type OrbVisual = {
  mode: BrandMarkMode;
  tone: AiOrbTone;
  /** A resting state: it moves for `settleMs` after it starts, then holds still. */
  settles: boolean;
};

// The assistant is the Anuntech symbol itself: still at rest (design.md: it moves only while
// the assistant works), light circling the pixels while it thinks, pixels lighting up one by
// one while it writes. Outcomes that need the person keep the still logo in their own colour,
// with the words beside it saying what happened.
const VISUALS: Record<AiOrbState, OrbVisual> = {
  idle: { mode: "still", tone: "primary", settles: false },
  // The microphone: a wave crosses the pixels for as long as the recording lasts.
  listening: { mode: "loading", tone: "primary", settles: false },
  thinking: { mode: "thinking", tone: "primary", settles: false },
  reasoning: { mode: "thinking", tone: "primary", settles: false },
  "tool-call": { mode: "thinking", tone: "primary", settles: false },
  "tool-result": { mode: "thinking", tone: "primary", settles: false },
  streaming: { mode: "writing", tone: "primary", settles: false },
  "waiting-approval": { mode: "loading", tone: "attention", settles: true },
  error: { mode: "still", tone: "critical", settles: false },
  done: { mode: "still", tone: "primary", settles: false },
};

/** Theme variable per tone. */
const TONE_TOKENS: Record<AiOrbTone, string> = {
  primary: "--primary",
  muted: "--muted-foreground",
  attention: "--warning",
  critical: "--destructive",
};

// ---------------------------------------------------------------- component

const SIZE = {
  lg: "size-16",
  md: "size-8",
  sm: "size-5",
} as const;

export type AiOrbProps = Omit<ComponentProps<"span">, "aria-hidden" | "aria-label" | "children" | "role"> & {
  state: AiOrbState;
  /** `sm` sits inline with text (20 px), `md` is a compact avatar (32 px), `lg` an avatar (64 px). */
  size?: keyof typeof SIZE;
  /** Accessible name; defaults to a sentence describing the state. */
  label?: string;
  /** Hide from assistive technology when nearby text already says the same. */
  decorative?: boolean;
  /** A theme variable that replaces the state's tint, e.g. `--primary-foreground` on a primary button. */
  colorToken?: string;
  /** How long a resting state keeps moving before it holds still, ms. Default 5000. */
  settleMs?: number;
};

/** `true` once a resting state has lasted `settleMs`; any state change starts over. */
function useSettled(state: AiOrbState, settles: boolean, settleMs: number) {
  const [rest, setRest] = useState({ state, still: false });
  // A new state moves again, even one the mark already settled in before.
  if (rest.state !== state) setRest({ state, still: false });
  useEffect(() => {
    if (!settles) return;
    const timer = setTimeout(() => setRest({ state, still: true }), settleMs);
    return () => clearTimeout(timer);
  }, [settleMs, settles, state]);
  return settles && rest.state === state && rest.still;
}

/**
 * Animated assistant-state indicator: the Anuntech symbol (BrandMark). Pass what
 * the assistant is doing; it picks the motion and a theme tint. Resting states
 * stop moving after a few seconds (WCAG 2.2.2), idle never moves, and
 * `prefers-reduced-motion` gets the still logo.
 */
export function AiOrb({
  state,
  size = "lg",
  label,
  decorative = false,
  colorToken,
  settleMs = 5000,
  className,
  style,
  ...rest
}: AiOrbProps) {
  // A state this build does not know (a newer server's) rests instead of breaking the dock.
  const visual = VISUALS[state] ?? VISUALS.idle;
  const settled = useSettled(state, visual.settles, settleMs);
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { "aria-label": label ?? AI_ORB_LABELS[state], role: "img" as const };

  return (
    <span
      {...rest}
      {...a11y}
      className={cn("relative inline-block shrink-0", SIZE[size], className)}
      style={{ color: `var(${colorToken ?? TONE_TOKENS[visual.tone]})`, ...style }}
      data-orb={visual.mode}
      data-slot="ai-orb"
      data-state={state}
    >
      <BrandMark mode={settled ? "still" : visual.mode} accent="var(--foreground)" className="size-full" />
    </span>
  );
}

export default AiOrb;
