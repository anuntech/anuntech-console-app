import { Stack } from "expo-router";
import { fonts, usePalette } from "@/lib/theme";

export default function TicketsLayout() {
  const palette = usePalette();
  return (
    <Stack
      screenOptions={{
        headerTitleStyle: { fontFamily: fonts.semibold, color: palette.foreground },
        headerTintColor: palette.primary,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: palette.background },
        contentStyle: { backgroundColor: palette.background },
        headerBackTitle: "Chamados",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Chamados", headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: "Chamado" }} />
      <Stack.Screen name="novo" options={{ title: "Novo chamado", presentation: "modal", headerBackTitle: "Cancelar" }} />
    </Stack>
  );
}
