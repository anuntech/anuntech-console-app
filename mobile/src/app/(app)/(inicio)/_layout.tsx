import { Stack, router } from "expo-router";
import { HeaderIconButton, useStackOptions } from "@/lib/stack";

/**
 * Início and the areas its shortcuts open (Projetos, Contratos, Orçamentos,
 * Bookmarks). Lists get the large title; a detail screen draws its own name.
 */
export default function HomeLayout() {
  const options = useStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: "Início", headerLargeTitle: true }} />
      <Stack.Screen name="projetos/index" options={{ title: "Projetos", headerLargeTitle: true }} />
      <Stack.Screen name="projetos/[id]" options={{ title: "" }} />
      <Stack.Screen name="projetos/atividade" options={{ title: "Atividade do projeto" }} />
      <Stack.Screen name="projetos/tarefa/[id]" options={{ title: "" }} />
      {/* A new task and the task's form open as sheets. */}
      <Stack.Screen
        name="projetos/tarefa/nova"
        options={{
          title: "Nova tarefa",
          presentation: "modal",
          headerLeft: () => <HeaderIconButton symbol="xmark" label="Cancelar" onPress={() => router.back()} />,
        }}
      />
      <Stack.Screen
        name="projetos/tarefa/editar"
        options={{
          title: "Editar tarefa",
          presentation: "modal",
          headerLeft: () => <HeaderIconButton symbol="xmark" label="Cancelar" onPress={() => router.back()} />,
        }}
      />
      <Stack.Screen name="contratos/index" options={{ title: "Contratos", headerLargeTitle: true }} />
      <Stack.Screen name="contratos/[id]" options={{ title: "" }} />
      <Stack.Screen name="orcamentos/index" options={{ title: "Orçamentos", headerLargeTitle: true }} />
      <Stack.Screen name="orcamentos/[id]" options={{ title: "" }} />
      <Stack.Screen name="bookmarks" options={{ title: "Bookmarks", headerLargeTitle: true }} />
    </Stack>
  );
}
