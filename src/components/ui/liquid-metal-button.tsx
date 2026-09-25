"use client";

/**
 * LiquidMetalButton
 *
 * A black pill (or circle) rimmed by a live liquid-metal shader from Paper
 * Shaders, ported from the supplied component and adapted to the Console:
 * the shader fills the outer layer, an inset black pill sits on it, and the
 * label or icon floats above both. Feedback is instant on pointer down, the
 * metal speeds up on hover and on click, and a ripple marks the tap. With
 * "reduce motion" the metal stands still and the ripple is skipped; without
 * WebGL the rim falls back to a static chrome gradient. Extra props reach
 * the inner <button>, so it works as a tooltip or popover trigger.
 *
 * Dependencies: @paper-design/shaders, lucide-react
 */

import { liquidMetalFragmentShader, ShaderMount } from "@paper-design/shaders";
import { Sparkles } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface LiquidMetalButtonProps extends Omit<React.ComponentPropsWithRef<"button">, "children"> {
  /** Visible text in text mode; the accessible name in both modes. Default "Get Started" */
  label?: string;
  /** "text" is a wide pill with the label; "icon" is a circle with the icon. Default "text" */
  viewMode?: "text" | "icon";
  /** What the circle shows. Default a Sparkles icon */
  icon?: React.ReactNode;
  /** Height in px; text mode is about three times wider. Default 46 */
  size?: number;
}

const IDLE_SPEED = 0.6;
const HOVER_SPEED = 1;
const CLICK_SPEED = 2.4;

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (onChange: () => void) => {
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};
const readMotion = () => window.matchMedia(reducedMotionQuery).matches;
const readMotionOnServer = () => false;

export function LiquidMetalButton({
  label = "Get Started",
  viewMode = "text",
  icon,
  size = 46,
  className,
  onClick,
  onPointerEnter,
  onPointerLeave,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  style,
  ...rest
}: LiquidMetalButtonProps) {
  const reduceMotion = React.useSyncExternalStore(subscribeMotion, readMotion, readMotionOnServer);
  const [hovered, setHovered] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);
  const [ripples, setRipples] = React.useState<{ x: number; y: number; id: number }[]>([]);
  const shaderHost = React.useRef<HTMLDivElement>(null);
  const shader = React.useRef<ShaderMount | null>(null);
  const hoveredRef = React.useRef(false);
  const rippleId = React.useRef(0);

  const height = size;
  const width = viewMode === "icon" ? size : Math.round(size * 3.1);

  React.useEffect(() => {
    const host = shaderHost.current;
    if (!host) return;
    try {
      shader.current = new ShaderMount(
        host,
        liquidMetalFragmentShader,
        {
          u_colorBack: [0, 0, 0, 0],
          u_colorTint: [1, 1, 1, 0],
          u_image: undefined,
          u_isImage: false,
          u_repetition: 4,
          u_softness: 0.5,
          u_shiftRed: 0.3,
          u_shiftBlue: 0.3,
          u_distortion: 0,
          u_contour: 0,
          u_angle: 45,
          u_shape: 1,
        },
        undefined,
        reduceMotion ? 0 : IDLE_SPEED,
      );
    } catch (error) {
      // No WebGL: the static chrome gradient behind the canvas stays visible.
      console.warn("[liquid-metal-button] shader unavailable", error instanceof Error ? error.message : error);
      shader.current = null;
    }
    return () => {
      shader.current?.dispose();
      shader.current = null;
    };
  }, [reduceMotion]);

  const setSpeed = (speed: number) => {
    if (!reduceMotion) shader.current?.setSpeed(speed);
  };

  return (
    <div
      className={cn("relative inline-block select-none", className)}
      style={{ width, height, ...style }}
    >
      {/* Outer layer: the liquid metal, with a chrome gradient underneath as the no-WebGL fallback. */}
      <div
        aria-hidden="true"
        className="liquid-metal-shader absolute inset-0 overflow-hidden rounded-full transition-[transform,box-shadow] duration-150 ease-out"
        style={{
          transform: pressed ? "translateY(1px) scale(0.98)" : "translateY(0) scale(1)",
          background: "conic-gradient(from 210deg, #6b6b6b, #f2f2f2 25%, #7a7a7a 45%, #e6e6e6 65%, #5c5c5c 85%, #6b6b6b)",
          boxShadow: pressed
            ? "0 0 0 1px rgba(0,0,0,.5), 0 1px 2px rgba(0,0,0,.3)"
            : hovered
              ? "0 0 0 1px rgba(0,0,0,.4), 0 12px 6px rgba(0,0,0,.05), 0 8px 5px rgba(0,0,0,.1), 0 4px 4px rgba(0,0,0,.15), 0 1px 2px rgba(0,0,0,.2)"
              : "0 0 0 1px rgba(0,0,0,.3), 0 20px 12px rgba(0,0,0,.06), 0 9px 9px rgba(0,0,0,.1), 0 2px 5px rgba(0,0,0,.15)",
        }}
      >
        <div ref={shaderHost} className="absolute inset-0" />
      </div>
      {/* Inner layer: the black pill the metal rims. */}
      <div
        aria-hidden="true"
        className="absolute inset-[2px] rounded-full transition-[transform,box-shadow] duration-150 ease-out"
        style={{
          background: "linear-gradient(180deg, #202020 0%, #000 100%)",
          transform: pressed ? "translateY(1px) scale(0.98)" : "translateY(0) scale(1)",
          boxShadow: pressed ? "inset 0 2px 4px rgba(0,0,0,.4), inset 0 1px 2px rgba(0,0,0,.3)" : "none",
        }}
      />
      {/* Content: the label or the icon. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 text-[#d4d4d4] [text-shadow:0_1px_2px_rgba(0,0,0,.5)]"
        style={{ transform: pressed ? "translateY(1px)" : "none", transition: "transform 150ms ease-out" }}
      >
        {viewMode === "icon" ? (
          (icon ?? <Sparkles size={Math.round(size * 0.42)} strokeWidth={1.8} className="drop-shadow-[0_1px_2px_rgba(0,0,0,.5)]" />)
        ) : (
          <span className="whitespace-nowrap text-sm font-normal">{label}</span>
        )}
      </div>
      <button
        type="button"
        aria-label={label}
        {...rest}
        className="absolute inset-0 cursor-pointer overflow-hidden rounded-full border-0 bg-transparent p-0 outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
        onPointerEnter={(event) => {
          hoveredRef.current = true;
          setHovered(true);
          setSpeed(HOVER_SPEED);
          onPointerEnter?.(event);
        }}
        onPointerLeave={(event) => {
          hoveredRef.current = false;
          setHovered(false);
          setPressed(false);
          setSpeed(IDLE_SPEED);
          onPointerLeave?.(event);
        }}
        onPointerDown={(event) => {
          setPressed(true);
          onPointerDown?.(event);
        }}
        onPointerUp={(event) => {
          setPressed(false);
          onPointerUp?.(event);
        }}
        onPointerCancel={(event) => {
          setPressed(false);
          onPointerCancel?.(event);
        }}
        onClick={(event) => {
          setSpeed(CLICK_SPEED);
          window.setTimeout(() => setSpeed(hoveredRef.current ? HOVER_SPEED : IDLE_SPEED), 300);
          if (!reduceMotion) {
            const rect = event.currentTarget.getBoundingClientRect();
            const ripple = { x: event.clientX - rect.left, y: event.clientY - rect.top, id: rippleId.current++ };
            setRipples((list) => [...list, ripple]);
            window.setTimeout(() => setRipples((list) => list.filter((r) => r.id !== ripple.id)), 600);
          }
          onClick?.(event);
        }}
      >
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            aria-hidden="true"
            className="liquid-metal-ripple pointer-events-none absolute size-5 rounded-full"
            style={{
              left: ripple.x,
              top: ripple.y,
              background: "radial-gradient(circle, rgba(255,255,255,.4) 0%, rgba(255,255,255,0) 70%)",
            }}
          />
        ))}
      </button>
    </div>
  );
}

export default LiquidMetalButton;
