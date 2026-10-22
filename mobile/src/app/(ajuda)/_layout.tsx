import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { Stack, useNavigation } from "expo-router";
import { GRACE_MS, lockEnabled } from "@/lib/lock";
import { useStackOptions } from "@/lib/stack";

/**
 * Ajuda and Como trabalhamos open over the tabs, from any of them, so they sit
 * outside the tabs' Face ID cover: coming back after the lock's time away,
 * they close and the lock underneath asks for Face ID.
 */
function useCloseWhenLocking() {
  const navigation = useNavigation();
  const leftAt = useRef<number | null>(null);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") leftAt.current = Date.now();
      if (state === "active" && leftAt.current && Date.now() - leftAt.current > GRACE_MS)
        void lockEnabled().then((on) => {
          if (on && navigation.canGoBack()) navigation.goBack();
        });
    });
    return () => subscription.remove();
  }, [navigation]);
}

export default function HelpLayout() {
  const options = useStackOptions();
  useCloseWhenLocking();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="ajuda/index" options={{ title: "Ajuda", headerLargeTitle: true }} />
      <Stack.Screen name="ajuda/[slug]" options={{ title: "" }} />
      <Stack.Screen name="como-trabalhamos" options={{ title: "Como trabalhamos", headerLargeTitle: true }} />
    </Stack>
  );
}
