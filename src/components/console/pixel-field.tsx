"use client";

import { cn } from "@/lib/cn";
import { useEffect, useRef } from "react";

/**
 * The site's pixel field (anuntech-institucional-site, components/motion/pixel-field.tsx): a grid of
 * squares that lights up in violet near the cursor (or the finger) and fades slowly, with a few pixels
 * lighting up on their own now and then. Drawn on a canvas behind the content of its parent, which
 * must be positioned; it pauses off screen. The colours follow the theme: the grid is the text colour,
 * faint, and the light is the brand's. Reduced motion sees only the still grid.
 */
/** How visible the resting grid is. */
const GRID = 0.04;

export function PixelField({ className, cell = 22 }: { className?: string; cell?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // `color` carries the light (text-primary) and `outline-color` the grid (outline-foreground);
    // used as they are, with globalAlpha, so any colour format works.
    let light = "";
    let grid = "";
    const readColors = () => {
      const style = getComputedStyle(canvas);
      light = style.color;
      grid = style.outlineColor;
    };
    readColors();
    const themed = new MutationObserver(readColors);
    themed.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });

    let w = 0;
    let h = 0;
    let cols = 0;
    let rows = 0;
    let heat = new Float32Array(0);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pointer = { x: -9999, y: -9999, active: false };

    const still = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = grid;
      ctx.globalAlpha = GRID;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) ctx.fillRect(x * cell + 3, y * cell + 3, cell - 6, cell - 6);
    };
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / cell);
      rows = Math.ceil(h / cell);
      heat = new Float32Array(cols * rows);
      if (reduce) still();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    if (reduce)
      return () => {
        ro.disconnect();
        themed.disconnect();
      };

    const host = canvas.parentElement ?? canvas;
    const move = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.active = true;
    };
    const leave = () => (pointer.active = false);
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerleave", leave);

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);

    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!visible) return;
      ctx.clearRect(0, 0, w, h);
      const radius = cell * 4.5;
      const s = cell - 6;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const cx = x * cell + cell / 2;
          const cy = y * cell + cell / 2;
          if (pointer.active) {
            const d = Math.hypot(cx - pointer.x, cy - pointer.y);
            if (d < radius) heat[i] = Math.max(heat[i], 1 - d / radius);
          }
          if (Math.random() < 0.00035) heat[i] = Math.max(heat[i], 0.55);
          const v = heat[i];
          ctx.fillStyle = grid;
          ctx.globalAlpha = GRID;
          ctx.fillRect(x * cell + 3, y * cell + 3, s, s);
          if (v > 0.01) {
            ctx.fillStyle = light;
            ctx.globalAlpha = v * 0.85;
            ctx.fillRect(x * cell + 3, y * cell + 3, s, s);
            heat[i] = v * 0.94;
          }
        }
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      themed.disconnect();
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", leave);
    };
  }, [cell]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 h-full w-full text-primary outline-foreground", className)}
    />
  );
}
