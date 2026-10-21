import { Stack } from "expo-router";
import { fonts, usePalette } from "@/lib/theme";

export default function FinanceLayout() {
  const palette = usePalette();
  return (
    <Stack
      screenOptions={{
        headerTitleStyle: { fontFamily: fonts.semibold, color: palette.foreground },
        headerTintColor: palette.primary,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: palette.background },
        contentStyle: { backgroundColor: palette.background },
        headerBackTitle: "Faturas",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Faturas", headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: "Fatura" }} />
    </Stack>
  );
}
