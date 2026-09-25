"use client";

import { useEffect, useRef, type CSSProperties, type DetailedHTMLProps, type HTMLAttributes, type Ref } from "react";

/**
 * EnergyOrb: the supplied <energy-orb> Web Component (WebGL, no dependencies)
 * for React. The element's script loads in the browser only; until it paints,
 * a static blue gradient holds its place, so the first frame never pops in.
 * The shader lives untouched in energy-orb-element.js.
 */

export type EnergyOrbElement = HTMLElement & { energy: number; speed: number; pulse: () => void };

type OrbAttributes = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  energy?: string | number;
  speed?: string | number;
  sparkles?: "on" | "off";
  glow?: "on" | "off";
  interactive?: "on" | "off";
};
declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- JSX intrinsic elements are declared on this namespace
  namespace JSX {
    interface IntrinsicElements {
      "energy-orb": OrbAttributes;
    }
  }
}

let loading: Promise<unknown> | null = null;
const load = () => (loading ??= import("./energy-orb-element.js"));

// The component's own fallback look, shown before the script runs.
const placeholder = "radial-gradient(circle at 40% 35%, #cfe9ff 0%, #5d9cf0 25%, #2553b5 60%, #86c2ff 100%)";

/** The orb standing still: its fallback gradient, no WebGL. For places that repeat it. */
export function StaticOrb({ size, className }: { size: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ display: "inline-block", flexShrink: 0, width: size, height: size, borderRadius: "50%", background: placeholder }}
    />
  );
}

export function EnergyOrb({
  size,
  energy = 1,
  speed = 1,
  sparkles = true,
  glow = true,
  interactive = true,
  className,
  style,
  ref,
}: {
  /** Width and height in px; the orb is always round. */
  size: number;
  /** 0.3 to 2: brightness of the energy inside. */
  energy?: number;
  /** 0 to 3: how fast it moves (0 freezes it). */
  speed?: number;
  sparkles?: boolean;
  glow?: boolean;
  /** Hover energizes it, a press pulses it and the light follows the pointer. */
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
  /** The element itself, for pulse(). */
  ref?: Ref<EnergyOrbElement>;
}) {
  const own = useRef<HTMLElement>(null);
  useEffect(() => {
    void load();
    const element = own.current;
    // Browsers keep only ~16 WebGL contexts and drop the oldest: an orb that
    // leaves the page gives its context back. Checked a moment later, so a
    // remount that keeps the element (React's dev double run) keeps it too.
    return () => {
      setTimeout(() => {
        if (element && !element.isConnected)
          (element.shadowRoot?.querySelector("canvas")?.getContext("webgl")?.getExtension("WEBGL_lose_context"))?.loseContext();
      }, 0);
    };
  }, []);
  return (
    <energy-orb
      ref={(node: HTMLElement | null) => {
        own.current = node;
        if (typeof ref === "function") ref(node as EnergyOrbElement | null);
        else if (ref) (ref as { current: EnergyOrbElement | null }).current = node as EnergyOrbElement | null;
      }}
      aria-hidden="true"
      role="presentation"
      energy={energy}
      speed={speed}
      sparkles={sparkles ? "on" : "off"}
      glow={glow ? "on" : "off"}
      interactive={interactive ? "on" : "off"}
      className={className}
      style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: placeholder, ...style }}
    />
  );
}
