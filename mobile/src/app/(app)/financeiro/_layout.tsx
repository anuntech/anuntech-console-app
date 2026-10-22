import { Stack } from "expo-router";
import { useStackOptions } from "@/lib/stack";


// A screen opened from a notification still has its list behind it for "back".
export const unstable_settings = { initialRouteName: "index" };
export default function FinanceLayout() {
  const options = useStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: "Faturas", headerLargeTitle: true }} />
      <Stack.Screen name="[id]" options={{ title: "" }} />
    </Stack>
  );
}
