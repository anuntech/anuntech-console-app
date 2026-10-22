import { createContext, use, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Button } from "@/components/button";
import { Text } from "@/components/text";
import { space, usePalette } from "./theme";

const KEY = "console.lock";
/** After this long in the background the app asks for Face ID again. */
export const GRACE_MS = 5 * 60_000;

export async function lockAvailable() {
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}
export async function lockEnabled() {
  return (await SecureStore.getItemAsync(KEY)) === "on";
}
export async function setLockEnabled(on: boolean) {
  if (on) await SecureStore.setItemAsync(KEY, "on");
  else await SecureStore.deleteItemAsync(KEY);
}
export async function confirmIdentity(promptMessage: string) {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: "Cancelar",
  });
  return result.success;
}

/** Whether the person is past the lock: false while it is up and while the app still checks whether to show it. */
const UnlockedContext = createContext(false);
export function useUnlocked() {
  return use(UnlockedContext);
}

/**
 * Covers the app with a lock when the person turned it on in Conta: on
 * launch and after five minutes away. The session stays the same.
 */
export function AppLock({ children }: { children: ReactNode }) {
  const palette = usePalette();
  // "checking" until the stored choice is read: nothing opens on its own before that.
  const [lock, setLock] = useState<"checking" | "locked" | "open">("checking");
  const leftAt = useRef<number | null>(null);
  const unlock = async () => {
    if (await confirmIdentity("Destravar o Console")) setLock("open");
  };
  useEffect(() => {
    const lockIfEnabled = () =>
      lockEnabled()
        .then((on) => {
          if (!on) return setLock("open");
          setLock("locked");
          void unlock();
        })
        .catch(() => setLock("open"));
    void lockIfEnabled();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") leftAt.current = Date.now();
      if (state === "active" && leftAt.current && Date.now() - leftAt.current > GRACE_MS) {
        setLock((current) => (current === "locked" ? current : "checking"));
        void lockIfEnabled();
      }
    });
    return () => subscription.remove();
    // Once per mount: each check reads the stored choice again.
  }, []);
  return (
    <View style={{ flex: 1 }}>
      <UnlockedContext value={lock === "open"}>{children}</UnlockedContext>
      {lock === "locked" && (
        <View
          accessibilityViewIsModal
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: palette.background,
            alignItems: "center",
            justifyContent: "center",
            padding: space.block,
            gap: space.lg,
          }}
        >
          <Text variant="heading">Console travado</Text>
          <Text tone="muted" style={{ textAlign: "center" }}>
            Confirme que é você para continuar.
          </Text>
          <Button title="Destravar" onPress={() => void unlock()} />
        </View>
      )}
    </View>
  );
}
