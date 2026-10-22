import { useSyncExternalStore } from "react";
import { Appearance } from "react-native";
import * as SecureStore from "expo-secure-store";

/*
 * Aparência: Claro, Escuro or Sistema, as Configurações → Aparência on the
 * web. Like the web's cookie it stays on this device only. The choice goes
 * to the whole app through React Native's Appearance override, so the
 * native headers, the tab bar, the status bar and usePalette() all follow it.
 */

export type AppearanceChoice = "system" | "light" | "dark";

export const APPEARANCE_OPTIONS: { value: AppearanceChoice; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
  { value: "system", label: "Sistema" },
];

const KEY = "console.appearance";
const listeners = new Set<() => void>();
let current: AppearanceChoice = read();

function read(): AppearanceChoice {
  try {
    const stored = SecureStore.getItem(KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function apply(choice: AppearanceChoice) {
  // "unspecified" removes the override: the app follows the phone again.
  Appearance.setColorScheme(choice === "system" ? "unspecified" : choice);
}

/** Puts the stored choice on screen; called at launch, before the first frame, and once the window exists. */
export function applyStoredAppearance() {
  apply(current);
}

/** Saves the choice on this device and repaints the app with it. */
export async function setAppearance(choice: AppearanceChoice) {
  current = choice;
  apply(choice);
  listeners.forEach((listener) => listener());
  if (choice === "system") await SecureStore.deleteItemAsync(KEY);
  else await SecureStore.setItemAsync(KEY, choice);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The choice for Conta's row and screen. */
export function useAppearanceChoice() {
  return useSyncExternalStore(subscribe, () => current);
}

export const appearanceLabel = (choice: AppearanceChoice) =>
  APPEARANCE_OPTIONS.find((option) => option.value === choice)?.label ?? "Sistema";
