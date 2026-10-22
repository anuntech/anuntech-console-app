import { Stack } from "expo-router";
import { useStackOptions } from "@/lib/stack";

export default function AccountLayout() {
  const options = useStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: "Conta", headerLargeTitle: true }} />
      <Stack.Screen name="perfil" options={{ title: "Perfil" }} />
      <Stack.Screen name="ilustracao" options={{ title: "Escolher ilustração" }} />
      <Stack.Screen name="contatos" options={{ title: "Contatos de acesso" }} />
      <Stack.Screen name="email" options={{ title: "Alterar e-mail" }} />
      <Stack.Screen name="whatsapp" options={{ title: "WhatsApp" }} />
      <Stack.Screen name="seguranca" options={{ title: "Segurança" }} />
      <Stack.Screen name="excluir" options={{ title: "Excluir conta" }} />
      {/* The other screens of Empresa set their own titles; inviting opens as a sheet. */}
      <Stack.Screen name="membros/convidar" options={{ presentation: "modal" }} />
    </Stack>
  );
}
