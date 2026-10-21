import { Stack } from "expo-router";
import { fonts, usePalette } from "@/lib/theme";

export default function AccountLayout() {
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
      <Stack.Screen name="index" options={{ title: "Conta", headerShown: false }} />
      <Stack.Screen name="excluir" options={{ title: "Excluir conta" }} />
    </Stack>
  );
}
