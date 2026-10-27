import { router, Stack } from "expo-router";
import { HeaderIconButton, useStackOptions } from "@/lib/stack";

/** A form over the list, closed by the X (or a swipe down). */
const sheet = {
  presentation: "modal",
  headerLeft: () => <HeaderIconButton symbol="xmark" label="Cancelar" onPress={() => router.back()} />,
} as const;

/**
 * Início and the areas its shortcuts open (Projetos, Produtos e serviços,
 * Contratos, Orçamentos, Arquivos). Lists get the large title; a detail screen draws its own name.
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
      <Stack.Screen name="bookmarks/index" options={{ title: "Arquivos", headerLargeTitle: true }} />
      {/* Adding, editing, renaming, moving and the folder forms open as sheets; the board opens full size. */}
      <Stack.Screen name="bookmarks/novo" options={{ title: "Adicionar", ...sheet }} />
      <Stack.Screen name="bookmarks/[id]/editar" options={{ title: "Editar", ...sheet }} />
      <Stack.Screen name="bookmarks/[id]/renomear" options={{ title: "Renomear", ...sheet }} />
      <Stack.Screen name="bookmarks/links" options={{ title: "Compartilhar por link", ...sheet }} />
      <Stack.Screen name="bookmarks/mover-pasta" options={{ title: "Mover pasta", ...sheet }} />
      <Stack.Screen name="bookmarks/[id]/mover" options={{ title: "Mover para", ...sheet }} />
      <Stack.Screen name="bookmarks/pasta" options={{ title: "Nova pasta", ...sheet }} />
      <Stack.Screen name="bookmarks/compartilhar" options={{ title: "Compartilhar", ...sheet }} />
      <Stack.Screen name="bookmarks/[id]/lousa" options={{ title: "Lousa", headerTransparent: false }} />
      {/* A file, as the web's viewer: the picture or the page, its details, and the list's other files. */}
      <Stack.Screen name="bookmarks/[id]/ver" options={{ title: "" }} />
      <Stack.Screen name="produtos/index" options={{ title: "Produtos e serviços", headerLargeTitle: true }} />
      <Stack.Screen name="produtos/[id]" options={{ title: "" }} />
      <Stack.Screen name="produtos/app/[id]" options={{ title: "" }} />
    </Stack>
  );
}
