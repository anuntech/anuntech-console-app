"use client";

import { cn } from "cn";
import { type ComponentProps, useEffect, useState, useSyncExternalStore } from "react";
import { type ModeOpts, type OrbState, ThinkingOrb } from "thinking-orbs";
import { AI_ORB_LABELS, type AiOrbState } from "./ai-orb-states";

export type { AiOrbState } from "./ai-orb-states";

// ---------------------------------------------------------------- states

/** Tint of the orb, always a theme token. */
export type AiOrbTone = "muted" | "primary" | "attention" | "critical";

type OrbVisual = {
  orb: OrbState;
  tone: AiOrbTone;
  /** Multiplier on the library's tuned speed. */
  speed: number;
  /** A frozen frame instead of an animation. */
  paused: boolean;
  /** A resting state: it moves for `settleMs` after it starts, then holds still. */
  settles: boolean;
  /** The library's own knobs; `shape` holds "shaping" on one outline (0 circle, 1 triangle, 2 square). */
  opts?: ModeOpts;
};

const CALM = 0.6;

// At rest the orb holds still (design.md: it moves only while the assistant works). Each outcome
// also has its own shape, never only its colour, held so it never freezes mid-morph: a card
// waiting is a square, an error a triangle.
const VISUALS: Record<AiOrbState, OrbVisual> = {
  idle: { orb: "breathing", tone: "primary", speed: CALM, paused: true, settles: false },
  // The microphone: it moves for as long as the recording lasts.
  listening: { orb: "listening", tone: "primary", speed: 1, paused: false, settles: false },
  thinking: { orb: "working", tone: "primary", speed: 1, paused: false, settles: false },
  reasoning: { orb: "solving", tone: "primary", speed: 1, paused: false, settles: false },
  "tool-call": { orb: "searching", tone: "primary", speed: 1, paused: false, settles: false },
  "tool-result": { orb: "connecting", tone: "primary", speed: 1, paused: false, settles: false },
  streaming: { orb: "composing", tone: "primary", speed: 1, paused: false, settles: false },
  "waiting-approval": { orb: "shaping", tone: "attention", speed: 0.8, paused: false, settles: true, opts: { shape: 2 } },
  error: { orb: "shaping", tone: "critical", speed: 1, paused: true, settles: false, opts: { shape: 1 } },
  done: { orb: "breathing", tone: "primary", speed: CALM, paused: false, settles: true },
};

/**
 * Theme variables per tone, first one defined wins. The raw tokens of
 * globals.css: Tailwind's `--color-*` names are inlined into utilities and do
 * not exist at runtime, and `--color-chart-5` is red in this theme.
 */
const TONE_TOKENS: Record<AiOrbTone, readonly string[]> = {
  primary: ["--primary"],
  muted: ["--muted-foreground"],
  attention: ["--warning"],
  critical: ["--destructive"],
};

// ---------------------------------------------------------------- theme colour

/**
 * The orb paints on a canvas and takes its tint as a hex string, while a
 * theme defines its tokens in any CSS colour syntax. The browser resolves the
 * token on a hidden probe and a 1×1 canvas converts it to sRGB hex. The
 * Console sets its theme on `<html>` only (`data-theme`, and `system` follows
 * the OS), so the probe sits at the root and one cache serves every orb,
 * cleared whenever either changes.
 */
const colors = new Map<string, string | undefined>();
let subscribers = 0;

function subscribeTheme(onChange: () => void): () => void {
  // The theme may have changed while no orb was on screen (signed out, OS at sunset): start fresh.
  if (subscribers++ === 0) colors.clear();
  const changed = () => {
    colors.clear();
    onChange();
  };
  const observer = new MutationObserver(changed);
  observer.observe(document.documentElement, {
    attributeFilter: ["class", "style", "data-theme"],
    attributes: true,
  });
  const scheme = window.matchMedia("(prefers-color-scheme: dark)");
  scheme.addEventListener("change", changed);
  return () => {
    subscribers--;
    observer.disconnect();
    scheme.removeEventListener("change", changed);
  };
}

let painter: CanvasRenderingContext2D | null | undefined;

/** Hex of the first defined token in `tokens` ("--a,--b"), or undefined when none is. */
function resolveTokens(tokens: string): string | undefined {
  if (colors.has(tokens)) return colors.get(tokens);
  const probe = document.createElement("span");
  probe.style.display = "none";
  // Nested fallbacks; an undefined chain ends in transparent, which reads as "not resolved".
  probe.style.color = tokens.split(",").reduceRight((fallback, token) => `var(${token}, ${fallback})`, "transparent");
  document.documentElement.append(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  if (painter === undefined) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    painter = canvas.getContext("2d", { willReadFrequently: true });
  }
  let hex: string | undefined;
  if (painter && computed) {
    painter.clearRect(0, 0, 1, 1);
    painter.fillStyle = "transparent";
    painter.fillStyle = computed;
    painter.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = painter.getImageData(0, 0, 1, 1).data;
    if (a) hex = `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  }
  colors.set(tokens, hex);
  return hex;
}

/** Live hex value of the tone's token; `undefined` on the server. */
function useOrbColor(tone: AiOrbTone, override?: string): string | undefined {
  const tokens = override ?? TONE_TOKENS[tone].join(",");
  return useSyncExternalStore(
    subscribeTheme,
    () => resolveTokens(tokens),
    () => undefined,
  );
}

const noop = () => () => undefined;

const reducedQuery = "(prefers-reduced-motion: reduce)";
function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia(reducedQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const getReduced = () => window.matchMedia(reducedQuery).matches;
const getServerReduced = () => false;

// ---------------------------------------------------------------- component

const SIZE = {
  lg: { box: "size-16", dot: 1, px: 64 },
  md: { box: "size-8", dot: 1.15, px: 32 },
  sm: { box: "size-5", dot: 1.3, px: 20 },
} as const;

/** How long two animations overlap when the state changes, ms (tw-animate-css `duration-200`). */
const CROSSFADE_MS = 200;

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
  // A new state moves again, even one the orb already settled in before.
  if (rest.state !== state) setRest({ state, still: false });
  useEffect(() => {
    if (!settles) return;
    const timer = setTimeout(() => setRest({ state, still: true }), settleMs);
    return () => clearTimeout(timer);
  }, [settleMs, settles, state]);
  return settles && rest.state === state && rest.still;
}

type Layer = { key: string; orb: OrbState; opts: ModeOpts | undefined; color: string | undefined; speed: number };

/** The animation on screen and, for a moment after a change, the one fading out under it, as it was. */
function useCrossfade(current: Layer, reduced: boolean) {
  const [leaving, setLeaving] = useState<Layer | null>(null);
  const [shown, setShown] = useState(current);
  // Adjusting state during render on a prop change, as React recommends over an effect.
  if (shown.key !== current.key) {
    setLeaving(reduced ? null : shown);
    setShown(current);
  } else if (shown.color !== current.color || shown.speed !== current.speed) setShown(current);
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setLeaving(null), CROSSFADE_MS);
    return () => clearTimeout(timer);
  }, [leaving]);
  return { shown, leaving };
}

/**
 * Animated assistant-state indicator over `thinking-orbs`. Pass what the
 * assistant is doing; the orb picks the animation, its pace and a theme tint,
 * and crossfades between animations. Resting states stop moving after a few
 * seconds (WCAG 2.2.2), idle never moves, and `prefers-reduced-motion` gets a
 * still frame.
 */
export function AiOrb({
  state,
  size = "lg",
  label,
  decorative = false,
  colorToken,
  settleMs = 5000,
  className,
  ...rest
}: AiOrbProps) {
  // A state this build does not know (a newer server's) rests instead of breaking the dock.
  const visual = VISUALS[state] ?? VISUALS.idle;
  const reduced = useSyncExternalStore(subscribeReduced, getReduced, getServerReduced);
  const settled = useSettled(state, visual.settles, settleMs);
  const color = useOrbColor(visual.tone, colorToken);
  // Client-only canvas: render the box on the server, the orb after hydration.
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const { shown, leaving } = useCrossfade(
    {
      key: `${visual.orb}-${visual.opts?.shape ?? ""}-${visual.tone}`,
      orb: visual.orb,
      opts: visual.opts,
      color,
      speed: visual.speed,
    },
    reduced,
  );
  const preset = SIZE[size];
  const paused = visual.paused || reduced || settled;
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { "aria-label": label ?? AI_ORB_LABELS[state], role: "img" as const };

  return (
    <span
      {...rest}
      {...a11y}
      className={cn("relative inline-block shrink-0", preset.box, className)}
      data-orb={visual.orb}
      data-slot="ai-orb"
      data-state={state}
    >
      {mounted ? (
        <>
          {leaving ? (
            <span
              key={leaving.key}
              className="absolute inset-0 animate-out fade-out-0 fill-mode-forwards duration-200"
            >
              <ThinkingOrb
                aria-hidden
                color={leaving.color}
                dotSize={preset.dot}
                opts={leaving.opts}
                paused
                size={preset.px}
                speed={leaving.speed}
                state={leaving.orb}
              />
            </span>
          ) : null}
          <span
            key={shown.key}
            className={cn("absolute inset-0", leaving && "animate-in fade-in-0 duration-200")}
          >
            <ThinkingOrb
              aria-hidden
              color={shown.color}
              dotSize={preset.dot}
              opts={shown.opts}
              paused={paused}
              size={preset.px}
              speed={shown.speed}
              state={shown.orb}
            />
          </span>
        </>
      ) : null}
    </span>
  );
}

export default AiOrb;
