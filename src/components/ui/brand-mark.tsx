"use client";

import { cn } from "@/lib/cn";
import { type CSSProperties, useEffect, useId, useRef, useSyncExternalStore } from "react";
import { MARK_ANUN, MARK_CELLS, MARK_HALF, MARK_NAME_WIDTH, MARK_TECH } from "./brand-mark-shape";

/**
 * The Anuntech symbol, drawn piece by piece so it can move: the smooth half and
 * each pixel of the other half (shapes from anuntech-brand, brand-mark-shape.ts).
 * - still: the logo as printed.
 * - thinking: light circles the pixels while the smooth half breathes.
 * - writing: the pixels light up one by one, like text being typed, with a cursor.
 * - loading: a wave of light crosses the pixel columns.
 * - intro: the pixels arrive and lock in, the smooth half forms, the name appears (once).
 * Colour comes from CSS `color`. Reduced motion always gets the still logo.
 */
export type BrandMarkMode = "still" | "thinking" | "writing" | "loading" | "intro";

const GAP = 26;
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const clamp = (t: number) => Math.min(1, Math.max(0, t));
/** Pixels in reading order (rows, then columns): the order "writing" types them in. */
const ORDER = MARK_CELLS.map((_, i) => i).sort((a, b) => MARK_CELLS[a][1] - MARK_CELLS[b][1] || MARK_CELLS[a][0] - MARK_CELLS[b][0]);
/** Where each pixel starts the intro from, the same every time. */
const FROM = (() => {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return MARK_CELLS.map(() => [(rand() - 0.2) * 90, (rand() - 0.5) * 120, (rand() - 0.5) * 140] as const);
})();

const reducedQuery = "(prefers-reduced-motion: reduce)";
function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia(reducedQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function BrandMark({
  mode = "still",
  wordmark = false,
  accent = "var(--primary)",
  onIntroEnd,
  className,
  style,
}: {
  mode?: BrandMarkMode;
  /** The name beside the symbol (intro and splash screens). */
  wordmark?: boolean;
  /** The typing cursor's colour in "writing". */
  accent?: string;
  onIntroEnd?: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  const clip = useId();
  const cells = useRef<(SVGRectElement | null)[]>([]);
  const half = useRef<SVGGElement>(null);
  const wipe = useRef<SVGRectElement>(null);
  const anun = useRef<SVGPathElement>(null);
  const tech = useRef<SVGPathElement>(null);
  const done = useRef(onIntroEnd);
  useEffect(() => {
    done.current = onIntroEnd;
  }, [onIntroEnd]);
  const reduced = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(reducedQuery).matches,
    () => false,
  );

  useEffect(() => {
    const rects = cells.current;
    const reset = () => {
      for (const c of rects) if (c) Object.assign(c.style, { opacity: "1", transform: "", fill: "" });
      if (half.current) half.current.style.transform = "";
      wipe.current?.setAttribute("x", "0");
      wipe.current?.setAttribute("width", "50");
      for (const p of [anun.current, tech.current]) if (p) Object.assign(p.style, { opacity: "", transform: "" });
    };
    reset();
    if (mode === "still" || reduced) {
      if (mode === "intro") done.current?.();
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      if (mode === "thinking") {
        const w = (Math.PI * 2) / 1.3;
        rects.forEach((c, i) => {
          const [x, y, s] = MARK_CELLS[i];
          const v = 0.5 + 0.5 * Math.cos(Math.atan2(y + s / 2 - 50, x + s / 2 - 50) - w * t);
          if (c) c.style.opacity = String(0.18 + 0.82 * v * v);
        });
        if (half.current) half.current.style.transform = `scale(${0.965 + 0.035 * (0.5 + 0.5 * Math.sin(t * 3.2))})`;
      } else if (mode === "writing") {
        const per = 0.055;
        const k = Math.floor((t % (rects.length * per + 0.5)) / per);
        ORDER.forEach((idx, n) => {
          const c = rects[idx];
          if (!c) return;
          c.style.opacity = n <= k ? "1" : "0.16";
          c.style.fill = n === k ? accent : "";
        });
      } else if (mode === "loading") {
        rects.forEach((c, i) => {
          const col = Math.round((MARK_CELLS[i][0] - 50.8) / 9.2);
          if (c) c.style.opacity = String(0.22 + 0.78 * (0.5 + 0.5 * Math.sin(t * 6 - col * 0.9 - MARK_CELLS[i][1] * 0.02)));
        });
      } else if (mode === "intro") {
        rects.forEach((c, i) => {
          if (!c) return;
          const delay = (ORDER.indexOf(i) / rects.length) * 0.45;
          const p = ease((t - delay) / 0.7);
          const [dx, dy, r] = FROM[i];
          c.style.opacity = String(clamp((t - delay) / 0.25));
          c.style.transform = `translate(${dx * (1 - p)}px, ${dy * (1 - p)}px) rotate(${r * (1 - p)}deg)`;
        });
        const h = ease((t - 0.75) / 0.6);
        wipe.current?.setAttribute("x", String(50 - 50 * h));
        wipe.current?.setAttribute("width", String(50 * h));
        if (anun.current && tech.current) {
          const a = ease((t - 1.25) / 0.55);
          anun.current.style.opacity = String(a);
          anun.current.style.transform = `translateX(${(1 - a) * -14}px)`;
          tech.current.style.opacity = String(Math.floor(clamp((t - 1.55) / 0.5) * 5) / 5);
        }
        if (t > (wordmark ? 2.2 : 1.5)) return done.current?.();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [mode, reduced, wordmark, accent]);

  const width = wordmark ? 100 + GAP + MARK_NAME_WIDTH : 100;
  return (
    <svg viewBox={`0 0 ${width} 100`} aria-hidden="true" className={cn("block overflow-visible", className)} style={style} data-slot="brand-mark">
      <defs>
        <clipPath id={clip}>
          <rect ref={wipe} x="0" y="0" width="50" height="100" />
        </clipPath>
      </defs>
      <g ref={half} style={{ transformOrigin: "50px 50px" }}>
        <path fill="currentColor" d={MARK_HALF} clipPath={`url(#${clip})`} />
      </g>
      {MARK_CELLS.map(([x, y, s], i) => (
        <rect
          key={i}
          ref={(el) => {
            cells.current[i] = el;
          }}
          x={x}
          y={y}
          width={s}
          height={s}
          fill="currentColor"
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
      ))}
      {wordmark && (
        <g transform={`translate(${100 + GAP} ${50 + 76 * 0.27})`}>
          <path ref={anun} fill="currentColor" d={MARK_ANUN} />
          <path ref={tech} fill="currentColor" d={MARK_TECH} />
        </g>
      )}
    </svg>
  );
}
