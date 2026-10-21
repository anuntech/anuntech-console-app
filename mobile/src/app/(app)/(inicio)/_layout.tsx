import { Stack } from "expo-router";
import { fonts, usePalette } from "@/lib/theme";

/** Início and the areas its shortcuts open (Projetos, Contratos, Orçamentos, Bookmarks). */
export default function HomeLayout() {
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
      <Stack.Screen name="index" options={{ title: "Início", headerShown: false }} />
      <Stack.Screen name="projetos/index" options={{ title: "Projetos" }} />
      <Stack.Screen name="projetos/[id]" options={{ title: "Projeto" }} />
      <Stack.Screen name="contratos/index" options={{ title: "Contratos" }} />
      <Stack.Screen name="contratos/[id]" options={{ title: "Contrato" }} />
      <Stack.Screen name="orcamentos/index" options={{ title: "Orçamentos" }} />
      <Stack.Screen name="orcamentos/[id]" options={{ title: "Orçamento" }} />
      <Stack.Screen name="bookmarks" options={{ title: "Bookmarks" }} />
    </Stack>
  );
}
