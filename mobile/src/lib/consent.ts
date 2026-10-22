import { useEffect, useSyncExternalStore } from "react";
import * as SecureStore from "expo-secure-store";

/*
 * The person's consent to the assistant (App Review 5.1.2(i)): their
 * questions and the records the assistant reads go to a third-party AI
 * model. Asked once, before the first message; kept on the device. Conta
 * can turn it off with useAssistantConsent().setGranted(false).
 */

const KEY = "assistant-consent";

/** null until read from the device. */
let granted: boolean | null = null;
let reading: Promise<boolean> | null = null;
const listeners = new Set<() => void>();
/** The send waiting for the sheet's answer. */
let waiting: ((ok: boolean) => void) | null = null;

const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function read(): Promise<boolean> {
  if (granted !== null) return Promise.resolve(granted);
  reading ??= SecureStore.getItemAsync(KEY)
    .then((value) => value === "granted")
    .catch(() => false)
    .then((value) => {
      // A choice made while reading wins over what was stored.
      granted ??= value;
      reading = null;
      emit();
      return granted;
    });
  return reading;
}

/** Saves the answer and releases a send that was waiting for it. */
export async function setAssistantConsent(on: boolean) {
  if (on) await SecureStore.setItemAsync(KEY, "granted");
  else await SecureStore.deleteItemAsync(KEY);
  granted = on;
  emit();
  settleConsent(on);
}

/** Ends the wait without saving anything ("Agora não", or the sheet swiped away). */
export function settleConsent(ok: boolean) {
  const resolve = waiting;
  waiting = null;
  resolve?.(ok);
}

/**
 * True when the person already agreed. Otherwise opens the sheet (`present`)
 * and waits for its answer.
 */
export async function askAssistantConsent(present: () => void): Promise<boolean> {
  if (await read()) return true;
  settleConsent(false);
  return new Promise<boolean>((resolve) => {
    waiting = resolve;
    present();
  });
}

/** The consent for a screen (Conta's switch): null while it loads from the device. */
export function useAssistantConsent() {
  const value = useSyncExternalStore(subscribe, () => granted);
  useEffect(() => {
    void read();
  }, []);
  return { granted: value, setGranted: setAssistantConsent };
}
