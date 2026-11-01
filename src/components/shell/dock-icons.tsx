"use client";
import type { CSSProperties, ReactNode } from "react";
import { m, type LegacyAnimationControls, type Transition, type Variants } from "motion/react";

/*
 * The dock's icons: the same Lucide drawings the Console uses (lucide-react
 * 1.58), each with a short animation that plays once when the pointer or the
 * keyboard reaches the link. Motion follows lucide-animated
 * (https://lucide-animated.com, MIT) where it has the icon, and the same
 * style for the four it lacks. Rendered inside the dock's LazyMotion, with the
 * brand ease; the dock never starts them under reduced motion.
 */

export type DockIconName =
  | "dashboard"
  | "building"
  | "route"
  | "kanban"
  | "package"
  | "headset"
  | "receipt"
  | "bookmark"
  | "calculator"
  | "folders"
  | "mail";

const EASE = [0.2, 0, 0, 1] as const;
const base: Transition = { duration: 0.45, ease: EASE };
/** Transforms on a part scale around its own box, not the SVG's corner. */
const own: CSSProperties = { transformBox: "fill-box", transformOrigin: "center" };
const bottom: CSSProperties = { transformBox: "fill-box", transformOrigin: "bottom" };

/** A part that dips and comes back, one after the other by `custom`. */
const pop: Variants = {
  normal: { scale: 1 },
  animate: (i: number) => ({ scale: [1, 0.8, 1], transition: { ...base, delay: i * 0.06 } }),
};
/** A line drawn again from its start. */
const draw: Variants = {
  normal: { pathLength: 1, opacity: 1 },
  animate: (i: number) => ({ pathLength: [0, 1], opacity: [0, 1], transition: { ...base, delay: i * 0.08 } }),
};
/** A part that dims and lights up, like a key pressed or a window lit. */
const blink: Variants = {
  normal: { opacity: 1 },
  animate: (i: number) => ({ opacity: [1, 0.15, 1], transition: { duration: 0.4, ease: "easeInOut", delay: i * 0.05 } }),
};

const parts: Record<DockIconName, ReactNode> = {
  dashboard: (
    <>
      {[
        { width: 7, height: 9, x: 3, y: 3 },
        { width: 7, height: 5, x: 14, y: 3 },
        { width: 7, height: 9, x: 14, y: 12 },
        { width: 7, height: 5, x: 3, y: 16 },
      ].map((r, i) => (
        <m.rect key={i} {...r} rx={1} custom={i} variants={pop} style={own} />
      ))}
    </>
  ),
  building: (
    <>
      <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" />
      <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      <path d="M14 21v-3a2 2 0 0 0-4 0v3" />
      <m.path d="M10 8h4" custom={0} variants={blink} />
      <m.path d="M10 12h4" custom={2} variants={blink} />
    </>
  ),
  route: (
    <>
      <m.circle cx={6} cy={19} r={3} custom={0} variants={draw} />
      <m.path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" custom={1} variants={draw} />
      <m.circle cx={18} cy={5} r={3} custom={3} variants={draw} />
    </>
  ),
  kanban: (
    <>
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
      {["M8 10v4", "M12 10v2", "M16 10v6"].map((d, i) => (
        <m.path
          key={d}
          d={d}
          custom={i}
          variants={{
            normal: { scaleY: 1 },
            animate: (n: number) => ({ scaleY: [1, 0.3, 1], transition: { ...base, delay: n * 0.08 } }),
          }}
          style={bottom}
        />
      ))}
    </>
  ),
  package: (
    <m.g
      variants={{ normal: { y: 0 }, animate: { y: [0, -1.5, 0], transition: base } }}
    >
      <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
      <path d="M12 22V12" />
      <m.polyline points="3.29 7 12 12 20.71 7" custom={1} variants={draw} />
      <m.path d="m7.5 4.27 9 5.15" custom={2} variants={draw} />
    </m.g>
  ),
  headset: (
    <m.g
      style={own}
      variants={{
        normal: { rotate: 0 },
        animate: { rotate: [0, -10, 8, -4, 0], transition: { duration: 0.6, ease: "easeInOut" } },
      }}
    >
      <path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z" />
      <path d="M21 16v2a4 4 0 0 1-4 4h-5" />
    </m.g>
  ),
  receipt: (
    <>
      <path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z" />
      <m.path d="M14 8H8" custom={0} variants={draw} />
      <m.path d="M16 12H8" custom={1} variants={draw} />
      <m.path d="M13 16H8" custom={2} variants={draw} />
    </>
  ),
  bookmark: (
    <m.path
      d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z"
      style={{ transformBox: "fill-box", transformOrigin: "top" }}
      variants={{
        normal: { scaleY: 1, y: 0 },
        animate: { scaleY: [1, 1.12, 0.96, 1], y: [0, -1, 0, 0], transition: { duration: 0.5, ease: EASE } },
      }}
    />
  ),
  calculator: (
    <>
      <rect width={16} height={20} x={4} y={2} rx={2} />
      <m.line x1={8} x2={16} y1={6} y2={6} custom={0} variants={draw} />
      <path d="M16 14v4" />
      {["M8 10h.01", "M12 10h.01", "M16 10h.01", "M8 14h.01", "M12 14h.01", "M8 18h.01", "M12 18h.01"].map((d, i) => (
        <m.path key={d} d={d} custom={i} variants={blink} />
      ))}
    </>
  ),
  folders: (
    <>
      <m.path
        d="M20 5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2.5a1.5 1.5 0 0 1 1.2.6l.6.8a1.5 1.5 0 0 0 1.2.6z"
        variants={{ normal: { x: 0, y: 0 }, animate: { x: [0, 1.5, 0], y: [0, -1.5, 0], transition: base } }}
      />
      <path d="M3 8.268a2 2 0 0 0-1 1.738V19a2 2 0 0 0 2 2h11a2 2 0 0 0 1.732-1" />
    </>
  ),
  mail: (
    <m.g variants={{ normal: { y: 0 }, animate: { y: [0, -1.5, 0], transition: base } }}>
      <rect width={20} height={16} x={2} y={4} rx={2} />
      <m.path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" custom={1} variants={draw} />
    </m.g>
  ),
};

/** One dock icon; `controls` starts "animate" on hover or focus and settles back to "normal". */
export function DockIcon({ name, controls, size = 22 }: { name: DockIconName; controls: LegacyAnimationControls; size?: number }) {
  return (
    <m.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      initial="normal"
      animate={controls}
    >
      {parts[name]}
    </m.svg>
  );
}
