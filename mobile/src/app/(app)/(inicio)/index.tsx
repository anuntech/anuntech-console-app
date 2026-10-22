import { useEffect, useState, type ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated";
import { Stack, router } from "expo-router";
import { SymbolView } from "expo-symbols";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { useQuery } from "@tanstack/react-query";
import { Card, Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { SectionHeader } from "@/components/section-header";
import { IconTile } from "@/components/tile";
import { Bar, SkeletonRows, useDelayed } from "@/components/skeleton";
import { PressableScale } from "@/components/pressable-scale";
import { recordLooks } from "@/components/record-card";
import { TicketCard, type TicketRow } from "@/components/ticket-card";
import { InvoiceCard, type InvoiceRow } from "@/components/invoice-card";
import { useMe } from "@/lib/me";
import { api, errorMessage } from "@/lib/api";
import { money } from "@/lib/format";
import { easeOut } from "@/lib/motion";
import { registerForPush } from "@/lib/push";
import { raised, rounded, space, usePalette } from "@/lib/theme";
import { useTabBarSpace } from "@/lib/layout";

const PUSH_DISMISSED = "push-prompt-dismissed";
/** How many rows each list shows here; "Ver todos" opens the rest. */
const PREVIEW = 3;

/** Each block rises in a little after the one above it, on the first load (still under Reduce Motion). */
const rise = (index: number) =>
  FadeInDown.duration(220).easing(easeOut).delay(index * 40).reduceMotion(ReduceMotion.System);

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * The card that offers push notifications, once. Asking on launch reads as
 * noise; here it comes with the reason. When the phone already allows them,
 * the card stays away and this phone's token is sent to the Console again.
 */
function usePushPrompt() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const permission = await Notifications.getPermissionsAsync();
        if (permission.granted) {
          await registerForPush();
          return;
        }
        if (!permission.canAskAgain || (await SecureStore.getItemAsync(PUSH_DISMISSED))) return;
        if (live) setShow(true);
      } catch {
        /* Without the prompt the app still works. */
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  const dismiss = () => {
    setShow(false);
    void SecureStore.setItemAsync(PUSH_DISMISSED, "1").catch(() => undefined);
  };
  return {
    show,
    dismiss,
    enable: () => {
      dismiss();
      void registerForPush();
    },
  };
}

function PushCard({ onEnable, onDismiss }: { onEnable: () => void; onDismiss: () => void }) {
  const palette = usePalette();
  return (
    <Card style={{ flexDirection: "row", alignItems: "flex-start" }}>
      <IconTile icon="bell.badge.fill" color="violet" />
      <View style={{ flex: 1, gap: space.md }}>
        <Text variant="headline">Receba um aviso quando a equipe responder</Text>
        <Button size="small" title="Ativar avisos" onPress={onEnable} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Dispensar" hitSlop={12} onPress={onDismiss} style={{ padding: 4 }}>
        <SymbolView name="xmark" size={13} weight="semibold" tintColor={palette.tertiary} accessible={false} />
      </Pressable>
    </Card>
  );
}

/**
 * The dark card at the top with what needs the person: tickets waiting for
 * their answer and what there is to pay. Each half opens its tab.
 */
function AttentionCard({ waiting, toPay }: { waiting: TicketRow[]; toPay: InvoiceRow[] }) {
  const palette = usePalette();
  const total = toPay.reduce((sum, invoice) => sum + invoice.amountCents, 0);
  const overdue = toPay.filter((invoice) => invoice.display === "overdue").length;
  const overdueText = `${overdue} ${plural(overdue, "vencida", "vencidas")}`;
  const chevron = <SymbolView name="chevron.right" size={13} weight="semibold" tintColor={palette.heroMuted} accessible={false} />;
  return (
    <View style={{ backgroundColor: palette.hero, ...rounded(24), ...raised(palette, "float") }}>
      {waiting.length > 0 ? (
        <PressableScale
          scaleTo={0.98}
          accessibilityRole="button"
          accessibilityLabel={`Aguardando você: ${waiting.length} ${plural(waiting.length, "chamado", "chamados")}`}
          onPress={() => router.push("/chamados")}
          style={{ padding: 20, gap: space.xs }}
        >
          <Text variant="caption" style={{ color: palette.heroMuted }}>
            Aguardando você
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text variant="largeTitle" style={{ color: palette.heroForeground, fontVariant: ["tabular-nums"] }}>
              {waiting.length}
            </Text>
            <View
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.brand }}
            />
            <Text variant="subhead" style={{ flex: 1, color: palette.heroMuted }}>
              {plural(waiting.length, "chamado precisa da sua resposta", "chamados precisam da sua resposta")}
            </Text>
            {chevron}
          </View>
        </PressableScale>
      ) : null}
      {waiting.length > 0 && toPay.length > 0 ? (
        <View style={{ height: StyleSheet.hairlineWidth, marginHorizontal: 20, backgroundColor: "rgba(255,255,255,0.16)" }} />
      ) : null}
      {toPay.length > 0 ? (
        <PressableScale
          scaleTo={0.98}
          accessibilityRole="button"
          accessibilityLabel={[`A pagar: ${money(total)}`, overdue ? overdueText : null].filter(Boolean).join(", ")}
          onPress={() => router.push("/financeiro")}
          style={{ padding: 20, gap: space.xs }}
        >
          <Text variant="caption" style={{ color: palette.heroMuted }}>
            A pagar
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1, gap: space.xs }}>
              <Text variant="money" style={{ fontSize: 22, lineHeight: 28, color: palette.heroForeground }}>
                {money(total)}
              </Text>
              {overdue ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <SymbolView name="exclamationmark.triangle.fill" size={13} tintColor={palette.heroDanger} accessible={false} />
                  <Text variant="label" style={{ color: palette.heroDanger }}>
                    {overdueText}
                  </Text>
                </View>
              ) : null}
            </View>
            {chevron}
          </View>
        </PressableScale>
      ) : null}
    </View>
  );
}

/** A page block that rises in with the others. */
function Block({ index, children }: { index: number; children: ReactNode }) {
  return <Animated.View entering={rise(index)}>{children}</Animated.View>;
}

/** While the first load runs: the hero's place and a few rows. */
function HomeSkeleton() {
  return (
    <View style={{ gap: space.block }}>
      <Bar width="100%" height={140} radius={24} />
      <SkeletonRows count={3} inset={0} />
    </View>
  );
}

/**
 * Visão geral: what waits for the person (tickets waiting for them, invoices
 * to pay) and the latest tickets, from the same lists as the tabs, then the
 * areas outside the tab bar.
 */
export default function Home() {
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const me = useMe();
  const overview = useQuery({ queryKey: ["overview"], queryFn: () => api.overview.get({}) });
  const push = usePushPrompt();
  const loading = useDelayed(me.isPending || overview.isPending);
  const firstName = me.data?.name.split(" ")[0];
  const pending = me.data && !me.data.staff && me.data.companies.length === 0;
  const o = overview.data;
  const showCompany = !!me.data && (me.data.staff || me.data.companies.length > 1);
  const waiting = o?.waiting ?? [];
  const toPay = o?.canFinance ? o.toPay : [];
  const open = o ? o.recent.filter((t) => !o.waiting.some((w) => w.id === t.id)) : [];
  const nothing = o && !o.waiting.length && !o.toPay.length && !o.recent.length;
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: space.gutter, gap: space.block, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
      refreshControl={
        <RefreshControl
          refreshing={overview.isRefetching}
          onRefresh={() => void Promise.all([me.refetch(), overview.refetch()])}
        />
      }
    >
      <Stack.Screen options={{ title: firstName ? `Olá, ${firstName}` : "Início" }} />
      <Text variant="subhead" tone="muted" style={{ marginTop: -4 }}>
        {me.data?.staff ? "Equipe Anuntech" : me.data?.companies[0]?.name ?? "Console da Anuntech"}
      </Text>
      {loading ? <HomeSkeleton /> : null}
      {me.error || overview.error ? <Notice kind="error">{errorMessage(me.error ?? overview.error)}</Notice> : null}
      {pending ? (
        <Notice kind="warning">
          Falta só liberar seu acesso. Peça ao Administrador da sua empresa ou à equipe da Anuntech.
        </Notice>
      ) : null}
      {waiting.length > 0 || toPay.length > 0 ? (
        <Block index={0}>
          <AttentionCard waiting={waiting} toPay={toPay} />
        </Block>
      ) : null}
      {o && !pending && push.show ? (
        <Block index={1}>
          <PushCard onEnable={push.enable} onDismiss={push.dismiss} />
        </Block>
      ) : null}
      {waiting.length > 0 ? (
        <Block index={2}>
          <SectionHeader title="Aguardando você" count={waiting.length} action={{ label: "Ver todos", onPress: () => router.push("/chamados") }} />
          <Section>
            {waiting.slice(0, PREVIEW).map((t) => (
              <TicketCard key={t.id} ticket={t} showCompany={showCompany} />
            ))}
          </Section>
        </Block>
      ) : null}
      {toPay.length > 0 ? (
        <Block index={3}>
          <SectionHeader title="A pagar" count={toPay.length} action={{ label: "Ver todos", onPress: () => router.push("/financeiro") }} />
          <Section>
            {toPay.slice(0, PREVIEW).map((i) => (
              <InvoiceCard key={i.id} invoice={i} showCompany={showCompany} />
            ))}
          </Section>
        </Block>
      ) : null}
      {open.length > 0 ? (
        <Block index={4}>
          <SectionHeader title="Chamados em aberto" count={open.length} action={{ label: "Ver todos", onPress: () => router.push("/chamados") }} />
          <Section>
            {open.slice(0, PREVIEW).map((t) => (
              <TicketCard key={t.id} ticket={t} showCompany={showCompany} />
            ))}
          </Section>
        </Block>
      ) : null}
      {o && !pending ? (
        // The areas outside the tab bar; contracts and quotes only for whoever sees the money.
        <Block index={5}>
          <SectionHeader title="Atalhos" />
          <Section>
            <ListRow
              leading={<IconTile icon={recordLooks.project.icon} color={recordLooks.project.color} />}
              title="Projetos"
              subtitle="Quadros e entregas"
              onPress={() => router.push("/projetos")}
            />
            {o.canFinance ? (
              <ListRow
                leading={<IconTile icon={recordLooks.contract.icon} color={recordLooks.contract.color} />}
                title="Contratos"
                subtitle="Texto e assinaturas"
                onPress={() => router.push("/contratos")}
              />
            ) : null}
            {o.canFinance ? (
              <ListRow
                leading={<IconTile icon={recordLooks.quote.icon} color={recordLooks.quote.color} />}
                title="Orçamentos"
                subtitle="Propostas e respostas"
                onPress={() => router.push("/orcamentos")}
              />
            ) : null}
            <ListRow
              leading={<IconTile icon="bookmark.fill" color="ink" />}
              title="Bookmarks"
              subtitle="Links e arquivos"
              onPress={() => router.push("/bookmarks")}
            />
          </Section>
        </Block>
      ) : null}
      {nothing && !pending ? (
        <Block index={6}>
          <Card raised style={{ alignItems: "center", paddingVertical: space.block }}>
            <SymbolView name="checkmark.seal.fill" size={44} tintColor={palette.success} accessible={false} />
            <Text variant="heading" accessibilityRole="header" style={{ textAlign: "center" }}>
              Tudo em dia
            </Text>
            <Text variant="subhead" tone="muted" style={{ textAlign: "center" }}>
              Nenhum chamado em aberto e nada a pagar agora.
            </Text>
            <Button
              title="Abrir chamado"
              variant="secondary"
              icon="square.and.pencil"
              onPress={() => router.push("/chamados/novo")}
            />
          </Card>
        </Block>
      ) : null}
    </ScrollView>
  );
}
