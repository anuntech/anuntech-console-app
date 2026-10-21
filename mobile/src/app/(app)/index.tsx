import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { Card, Notice, Row } from "@/components/surface";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import { useMe } from "@/lib/me";
import { errorMessage } from "@/lib/api";
import { CONSOLE_URL } from "@/lib/config";
import { space, usePalette } from "@/lib/theme";

const roleLabel = { manager: "Administrador", member: "Membro" } as const;

/**
 * Home: who is signed in and their companies. The Console's areas arrive in
 * the app one at a time; until then the browser opens the full Console.
 */
export default function Home() {
  const palette = usePalette();
  const me = useMe();
  const firstName = me.data?.name.split(" ")[0];
  const pending = me.data && !me.data.staff && me.data.companies.length === 0;
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.block }}
        refreshControl={<RefreshControl refreshing={me.isRefetching} onRefresh={() => void me.refetch()} />}
      >
        <View style={{ gap: space.xs, marginTop: space.lg }}>
          <Text variant="caption" tone="muted">
            {me.data?.staff ? "Equipe Anuntech" : "Console da Anuntech"}
          </Text>
          <Text variant="title" accessibilityRole="header">
            {firstName ? `Olá, ${firstName}` : "Olá"}
          </Text>
        </View>
        {me.isPending && <ActivityIndicator accessibilityLabel="Carregando" />}
        {me.error && <Notice kind="error">{errorMessage(me.error)}</Notice>}
        {pending && (
          <Notice kind="info">
            Falta só liberar seu acesso. Peça ao Administrador da sua empresa ou à equipe da Anuntech.
          </Notice>
        )}
        {me.data && me.data.companies.length > 0 && (
          <Card>
            <Text variant="heading">{me.data.companies.length > 1 ? "Suas empresas" : "Sua empresa"}</Text>
            {me.data.companies.map((company) => (
              <Row key={company.id} title={company.name} detail={roleLabel[company.role]} />
            ))}
          </Card>
        )}
        {me.data && !pending && (
          <Card>
            <Text variant="heading">Chamados, financeiro e projetos</Text>
            <Text tone="muted">
              As áreas do Console chegam ao app aos poucos. Enquanto isso, abra o Console completo no navegador.
            </Text>
            <Button
              title="Abrir o Console no navegador"
              variant="outline"
              onPress={() => void WebBrowser.openBrowserAsync(`${CONSOLE_URL}/painel`)}
            />
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
