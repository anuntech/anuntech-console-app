import { Stack } from "expo-router";
import { fonts, usePalette } from "@/lib/theme";

/** The conversation and the list of earlier ones. */
export default function AssistantLayout() {
  const palette = usePalette();
  return (
    <Stack
      screenOptions={{
        headerTitleStyle: { fontFamily: fonts.semibold, color: palette.foreground },
        headerTintColor: palette.primary,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: palette.background },
        contentStyle: { backgroundColor: palette.background },
        headerBackTitle: "Voltar",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Assistente" }} />
      <Stack.Screen name="conversas" options={{ title: "Conversas" }} />
    </Stack>
  );
}
