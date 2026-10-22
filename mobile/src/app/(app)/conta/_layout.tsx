import { Stack } from "expo-router";
import { useStackOptions } from "@/lib/stack";

export default function AccountLayout() {
  const options = useStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: "Conta", headerLargeTitle: true }} />
      <Stack.Screen name="excluir" options={{ title: "Excluir conta" }} />
    </Stack>
  );
}
