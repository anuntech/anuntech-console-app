import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Card, Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import { TicketCard } from "@/components/ticket-card";
import { InvoiceCard } from "@/components/invoice-card";
import { useMe } from "@/lib/me";
import { api, errorMessage } from "@/lib/api";
import { space, usePalette } from "@/lib/theme";
import { useTabBarSpace } from "@/lib/layout";

/**
 * Visão geral: what waits for the person (tickets waiting for them, invoices
 * to pay) and the latest tickets, from the same lists as the tabs.
 */
export default function Home() {
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const me = useMe();
  const overview = useQuery({ queryKey: ["overview"], queryFn: () => api.overview.get({}) });
  const firstName = me.data?.name.split(" ")[0];
  const pending = me.data && !me.data.staff && me.data.companies.length === 0;
  const o = overview.data;
  const showCompany = !!me.data && (me.data.staff || me.data.companies.length > 1);
  const nothing = o && !o.waiting.length && !o.toPay.length && !o.recent.length;
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.block, paddingBottom: bottom }}
        scrollIndicatorInsets={{ bottom }}
        refreshControl={
          <RefreshControl
            refreshing={overview.isRefetching}
            onRefresh={() => void Promise.all([me.refetch(), overview.refetch()])}
          />
        }
      >
        <View style={{ gap: space.xs, marginTop: space.lg }}>
          <Text variant="caption" tone="muted">
            {me.data?.staff ? "Equipe Anuntech" : me.data?.companies[0]?.name ?? "Console da Anuntech"}
          </Text>
          <Text variant="title" accessibilityRole="header">
            {firstName ? `Olá, ${firstName}` : "Olá"}
          </Text>
        </View>
        {(me.isPending || overview.isPending) && <ActivityIndicator accessibilityLabel="Carregando" />}
        {(me.error || overview.error) && <Notice kind="error">{errorMessage(me.error ?? overview.error)}</Notice>}
        {pending && (
          <Notice kind="info">
            Falta só liberar seu acesso. Peça ao Administrador da sua empresa ou à equipe da Anuntech.
          </Notice>
        )}
        {o && o.waiting.length > 0 && (
          <View style={{ gap: space.md }}>
            <Text variant="heading">Aguardando você</Text>
            {o.waiting.map((t) => (
              <TicketCard key={t.id} ticket={t} showCompany={showCompany} />
            ))}
          </View>
        )}
        {o && o.toPay.length > 0 && (
          <View style={{ gap: space.md }}>
            <Text variant="heading">A pagar</Text>
            {o.toPay.map((i) => (
              <InvoiceCard key={i.id} invoice={i} showCompany={showCompany} />
            ))}
          </View>
        )}
        {o && o.recent.length > 0 && (
          <View style={{ gap: space.md }}>
            <Text variant="heading">Chamados em aberto</Text>
            {o.recent
              .filter((t) => !o.waiting.some((w) => w.id === t.id))
              .map((t) => (
                <TicketCard key={t.id} ticket={t} showCompany={showCompany} />
              ))}
          </View>
        )}
        {nothing && !pending && (
          <Card>
            <Text variant="heading">Tudo em dia</Text>
            <Text tone="muted">Nenhum chamado em aberto e nada a pagar agora.</Text>
            <Button title="Abrir chamado" variant="outline" onPress={() => router.push("/chamados/novo")} />
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
