import { Pressable } from "react-native";
import { Stack, router } from "expo-router";
import { Text } from "@/components/text";
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
      <Stack.Screen
        name="novo"
        options={{
          title: "Novo chamado",
          presentation: "modal",
          headerLeft: () => (
            <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.back()}>
              <Text variant="label" tone="primary" style={{ fontSize: 16 }}>
                Cancelar
              </Text>
            </Pressable>
          ),
        }}
      />
    </Stack>
  );
}
