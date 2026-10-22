import { Stack } from "expo-router";
import { useStackOptions } from "@/lib/stack";

export default function AuthLayout() {
  const options = useStackOptions();
  return <Stack screenOptions={{ ...options, headerShown: false }} />;
}
