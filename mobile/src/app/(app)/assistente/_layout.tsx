import { Stack } from "expo-router";
import { useStackOptions } from "@/lib/stack";
import { usePalette } from "@/lib/theme";

/** The conversation, the list of earlier ones, and the consent asked before the first message. */
export default function AssistantLayout() {
  const options = useStackOptions();
  const palette = usePalette();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: "Assistente" }} />
      <Stack.Screen name="conversas" options={{ title: "Conversas" }} />
      <Stack.Screen
        name="consentimento"
        options={{
          presentation: "formSheet",
          headerShown: false,
          sheetAllowedDetents: [0.6],
          sheetGrabberVisible: true,
          sheetCornerRadius: 24,
          contentStyle: { backgroundColor: palette.card },
        }}
      />
    </Stack>
  );
}
