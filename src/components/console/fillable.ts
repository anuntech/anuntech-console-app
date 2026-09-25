"use client";
import { useEffect, type RefObject } from "react";

/** Dispatched on a picker's hidden input when the assistant fills the screen. */
export const FILL_EVENT = "console:fill";

/**
 * Lets a custom picker (company, date, money, model) receive a value from
 * outside, the way a plain input receives one: the assistant's page bridge
 * dispatches `console:fill` on the hidden input and the component applies it.
 */
export function useFillable(ref: RefObject<HTMLElement | null>, apply: (value: string) => void) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const handler = (event: Event) => {
      const value = (event as CustomEvent<{ value?: unknown }>).detail?.value;
      if (typeof value === "string") apply(value);
    };
    element.addEventListener(FILL_EVENT, handler);
    return () => element.removeEventListener(FILL_EVENT, handler);
  }, [ref, apply]);
}
