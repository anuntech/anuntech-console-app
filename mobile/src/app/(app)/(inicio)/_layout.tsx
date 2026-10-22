import { Stack } from "expo-router";
import { useStackOptions } from "@/lib/stack";

/**
 * Início and the areas its shortcuts open (Projetos, Produtos e serviços,
 * Contratos, Orçamentos, Bookmarks). Lists get the large title; a detail screen draws its own name.
 */
export default function HomeLayout() {
  const options = useStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: "Início", headerLargeTitle: true }} />
      <Stack.Screen name="projetos/index" options={{ title: "Projetos", headerLargeTitle: true }} />
      <Stack.Screen name="projetos/[id]" options={{ title: "" }} />
      <Stack.Screen name="contratos/index" options={{ title: "Contratos", headerLargeTitle: true }} />
      <Stack.Screen name="contratos/[id]" options={{ title: "" }} />
      <Stack.Screen name="orcamentos/index" options={{ title: "Orçamentos", headerLargeTitle: true }} />
      <Stack.Screen name="orcamentos/[id]" options={{ title: "" }} />
      <Stack.Screen name="produtos/index" options={{ title: "Produtos e serviços", headerLargeTitle: true }} />
      <Stack.Screen name="produtos/[id]" options={{ title: "" }} />
      <Stack.Screen name="produtos/app/[id]" options={{ title: "" }} />
      <Stack.Screen name="bookmarks" options={{ title: "Bookmarks", headerLargeTitle: true }} />
    </Stack>
  );
}
