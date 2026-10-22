import { useSyncExternalStore } from "react";
import * as SecureStore from "expo-secure-store";
import { money } from "./format";

/*
 * The eye on Início: hides every amount in R$ and remembers the choice on
 * this phone (the web keeps it in a cookie). One value for the whole app, so
 * any screen that adopts useMoneyHidden() follows the same switch.
 */
const KEY = "money-hidden";
let hidden = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

void SecureStore.getItemAsync(KEY)
  .then((value) => {
    if (value === "1" && !hidden) {
      hidden = true;
      emit();
    }
  })
  .catch(() => undefined);

function setHidden(next: boolean) {
  hidden = next;
  emit();
  void (next ? SecureStore.setItemAsync(KEY, "1") : SecureStore.deleteItemAsync(KEY)).catch(() => undefined);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** Whether amounts are hidden on this phone, and the switch. */
export function useMoneyHidden() {
  const value = useSyncExternalStore(subscribe, () => hidden);
  return { hidden: value, toggle: () => setHidden(!value), setHidden };
}

/** What a hidden amount reads as on screen, and to VoiceOver. */
export const HIDDEN_MONEY = "R$ ••••";
export const HIDDEN_MONEY_LABEL = "valor escondido";

/** An amount, or its mask while the eye is closed. */
export const shownMoney = (cents: number, isHidden: boolean) => (isHidden ? HIDDEN_MONEY : money(cents));
/** The same for VoiceOver, which should not read the dots. */
export const spokenMoney = (cents: number, isHidden: boolean) => (isHidden ? HIDDEN_MONEY_LABEL : money(cents));
