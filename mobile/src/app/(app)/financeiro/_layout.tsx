import { Stack } from "expo-router";
import { useStackOptions } from "@/lib/stack";

export default function FinanceLayout() {
  const options = useStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: "Faturas", headerLargeTitle: true }} />
      <Stack.Screen name="[id]" options={{ title: "" }} />
    </Stack>
  );
}
