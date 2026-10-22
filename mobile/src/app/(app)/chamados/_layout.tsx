import { Stack, router } from "expo-router";
import { HeaderIconButton, useStackOptions } from "@/lib/stack";

export default function TicketsLayout() {
  const stack = useStackOptions();
  return (
    <Stack screenOptions={stack}>
      <Stack.Screen name="index" options={{ title: "Chamados", headerLargeTitleEnabled: true }} />
      {/* The subject is the title, drawn large in the content. */}
      <Stack.Screen name="[id]" options={{ title: "" }} />
      <Stack.Screen
        name="novo"
        options={{
          title: "Novo chamado",
          presentation: "modal",
          headerLeft: () => <HeaderIconButton symbol="xmark" label="Cancelar" onPress={() => router.back()} />,
        }}
      />
    </Stack>
  );
}
