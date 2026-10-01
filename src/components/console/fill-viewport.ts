"use client";
import { useLayoutEffect, useState, type RefObject } from "react";
import { useAppearance } from "@/components/shell/appearance-provider";

/** Space kept between the content and the dock (or the window's edge). */
const GAP = 12;

export type ViewportFit = {
  /** From the element's top to just above the bottom navigation. */
  height: number;
  /**
   * Space to keep below the element when the room left is under the
   * minimum: the page scrolls then, and its end must not hide under the dock.
   */
  clearance: number;
};

/**
 * How tall an element must be to reach down to just above the navigation at
 * the bottom of the screen (the dock, or the tab bar on a phone), or the
 * window's edge when the dock sits elsewhere. Measured where things really
 * are, so it follows the dock position, the safe area and whatever wraps
 * above the element. Null until measured on the client.
 *
 * The element carries `data-fill-viewport`, which drops the page's bottom
 * padding (globals.css) so the page itself does not scroll.
 */
export function useFillViewport(ref: RefObject<HTMLElement | null>, { min = 360, enabled = true } = {}) {
  const { position } = useAppearance();
  const [fit, setFit] = useState<ViewportFit | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const measure = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      let bottom = window.innerHeight - GAP;
      for (const nav of document.querySelectorAll<HTMLElement>('nav[aria-label="Navegação principal"]')) {
        const rect = nav.getBoundingClientRect();
        // Shown and along the bottom edge: the dock in its default place, or the phone's tab bar.
        if (rect.height && rect.top > window.innerHeight / 2) bottom = Math.min(bottom, rect.top - GAP);
      }
      const room = Math.floor(bottom - top);
      const next = {
        height: Math.max(min, room),
        clearance: room < min ? Math.ceil(window.innerHeight - bottom) : 0,
      };
      setFit((current) =>
        current && current.height === next.height && current.clearance === next.clearance ? current : next,
      );
    };
    measure();
    window.addEventListener("resize", measure);
    // Anything that wraps or grows above the element moves its top.
    const observer = new ResizeObserver(measure);
    if (el.parentElement) observer.observe(el.parentElement);
    return () => {
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [ref, position, min, enabled]);
  return fit;
}
