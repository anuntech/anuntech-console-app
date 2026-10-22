import { useSyncExternalStore } from "react";

/*
 * A server message that outlives the screen that got it: inviting or removing
 * someone closes that screen, and the list it returns to shows the answer.
 */
type Flash = { text: string; at: number } | null;

let current: Flash = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function showFlash(text: string) {
  current = { text, at: Date.now() };
  emit();
}

export function clearFlash() {
  if (!current) return;
  current = null;
  emit();
}

/** The message waiting to be shown, if any. */
export function useFlash() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
