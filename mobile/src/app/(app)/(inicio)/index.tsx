import { useEffect, useState, type ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated";
import { Stack, router } from "expo-router";
import { SymbolView, type SFSymbol } from "@/components/symbol";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { useQuery } from "@tanstack/react-query";
import { FirstStepsCard } from "@/components/first-steps-card";
import { Card, Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { SectionHeader } from "@/components/section-header";
import { IconTile, StatusTile } from "@/components/tile";
import { Bar, SkeletonRows, useDelayed } from "@/components/skeleton";
import { PressableScale } from "@/components/pressable-scale";
import { RecordRow, recordLooks } from "@/components/record-card";
import { ProductIcon } from "@/components/product-icon";
import { HoursBankCard } from "@/components/hours-bank-card";
import { TicketCard, type TicketRow } from "@/components/ticket-card";
import { InvoiceCard, type InvoiceRow } from "@/components/invoice-card";
import { useMe } from "@/lib/me";
import { api, errorMessage } from "@/lib/api";
import { civilDate } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { shownMoney, spokenMoney, useMoneyHidden } from "@/lib/money-hidden";
import { openProduct } from "@/lib/product-open";
import { openBookmark, openFileViewer } from "@/lib/bookmarks";
import { FileThumb } from "@/components/file-thumb";
import { HeaderIconButton } from "@/lib/stack";
import type { ToneName } from "@/lib/status";
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

/** The site's address without the scheme and path ("console.anuntech.com"). */
const hostOf = (url: string | null) => (url ? url.replace(/^[a-z]+:\/\//i, "").split(/[/?#]/)[0] || null : null);

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
 * their answer and what there is to pay. Each half opens its tab. The amount
 * follows the eye.
 */
function AttentionCard({ waiting, toPay, hideMoney }: { waiting: TicketRow[]; toPay: InvoiceRow[]; hideMoney: boolean }) {
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
          onPress={() => router.push({ pathname: "/chamados", params: { status: "waiting_customer" } })}
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
          accessibilityLabel={[`A pagar: ${spokenMoney(total, hideMoney)}`, overdue ? overdueText : null].filter(Boolean).join(", ")}
          onPress={() => router.push("/financeiro")}
          style={{ padding: 20, gap: space.xs }}
        >
          <Text variant="caption" style={{ color: palette.heroMuted }}>
            A pagar
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1, gap: space.xs }}>
              <Text variant="money" style={{ fontSize: 22, lineHeight: 28, color: palette.heroForeground }}>
                {shownMoney(total, hideMoney)}
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

type Overview = Awaited<ReturnType<typeof api.overview.get>>;

/**
 * "Precisa de atenção", as the web's Painel: a suspended product first, then
 * what waits for an Administrador's decision. Each row opens where it is
 * decided. Left out when there is nothing.
 */
function AttentionList({ attention }: { attention: Overview["attention"] }) {
  const rows: { key: string; icon: SFSymbol; tone: ToneName; title: string; detail?: string; count: number; open: () => void }[] = [];
  const suspended = attention.suspended;
  if (suspended.length)
    rows.push({
      key: "suspended",
      icon: "nosign",
      tone: "danger",
      title: suspended.length === 1 ? `${suspended[0].name} está suspenso` : "Produtos suspensos",
      detail: "Nenhum dado foi apagado. Veja como reativar",
      count: suspended.length,
      open: () =>
        suspended.length === 1
          ? router.push({ pathname: "/produtos/[id]", params: { id: suspended[0].id } })
          : router.push("/produtos"),
    });
  if (attention.quotesToAnswer)
    rows.push({ key: "quotes", icon: "list.bullet.rectangle.portrait.fill", tone: "attention", title: "Orçamentos para você responder", count: attention.quotesToAnswer, open: () => router.push({ pathname: "/orcamentos", params: { status: "sent" } }) });
  if (attention.contractsToSign)
    rows.push({ key: "contracts", icon: "signature", tone: "attention", title: "Contratos para você assinar", count: attention.contractsToSign, open: () => router.push({ pathname: "/contratos", params: { status: "sent" } }) });
  if (attention.estimates.count) {
    const ticketId = attention.estimates.ticketId;
    rows.push({
      key: "estimates",
      icon: "clock.fill",
      tone: "info",
      title: "Estimativas de melhoria para aprovar",
      count: attention.estimates.count,
      open: () => (ticketId ? router.push({ pathname: "/chamados/[id]", params: { id: ticketId } }) : router.push("/chamados")),
    });
  }
  if (attention.reviews.count) {
    const projectId = attention.reviews.projectId;
    rows.push({
      key: "reviews",
      icon: "checkmark.circle.fill",
      tone: "attention",
      title: "Entregas para você revisar",
      detail: "Aprove ou aponte o problema em cada cartão",
      count: attention.reviews.count,
      open: () => (projectId ? router.push({ pathname: "/projetos/[id]", params: { id: projectId } }) : router.push("/projetos")),
    });
  }
  if (!rows.length) return null;
  return (
    <View>
      <SectionHeader title="Precisa de atenção" />
      <Section>
        {rows.map((row) => (
          <ListRow
            key={row.key}
            leading={<StatusTile icon={row.icon} tone={row.tone} />}
            title={row.title}
            subtitle={row.detail}
            value={String(row.count)}
            valueTone={row.tone === "danger" ? "destructive" : "foreground"}
            accessibilityLabel={[row.title, `${row.count}`, row.detail].filter(Boolean).join(", ")}
            onPress={row.open}
          />
        ))}
      </Section>
    </View>
  );
}

/** A thin bar with the share of the board already done (the row says it in words). */
function Progress({ done, total }: { done: number; total: number }) {
  const palette = usePalette();
  const share = total ? done / total : 0;
  return (
    <View style={{ height: 6, ...rounded(999), backgroundColor: palette.fill, overflow: "hidden" }}>
      <View style={{ width: `${Math.round(share * 100)}%`, height: 6, backgroundColor: palette.success }} />
    </View>
  );
}

/** "A próxima cobrança, de R$ X, vence em …. Boleto e Pix chegam até …", as the web's empty A pagar. */
const nextChargeText = (charge: NonNullable<Overview["nextCharge"]>, hideMoney: boolean, speak = false) =>
  `A próxima cobrança, de ${speak ? spokenMoney(charge.amountCents, hideMoney) : shownMoney(charge.amountCents, hideMoney)}, vence em ${civilDate(charge.dueDate)}. Boleto e Pix chegam até ${civilDate(charge.issueDate)}.`;

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
 * to pay, the decisions of "Precisa de atenção"), the hours bank, then
 * projects, products and bookmarks as the web's Painel shows them, and the
 * areas outside the tab bar. The eye hides every amount on this screen.
 */
export default function Home() {
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const me = useMe();
  const overview = useQuery({ queryKey: ["overview"], queryFn: () => api.overview.get({}) });
  const push = usePushPrompt();
  const eye = useMoneyHidden();
  const loading = useDelayed(me.isPending || overview.isPending);
  const firstName = me.data?.name.split(" ")[0];
  const pending = me.data && !me.data.staff && me.data.companies.length === 0;
  const o = overview.data;
  const showCompany = !!o?.showCompany;
  const waiting = o?.waiting ?? [];
  const toPay = o?.canFinance ? o.toPay : [];
  // Only someone who sees money gets the eye; a Membro has no values to hide.
  const hideMoney = !!o?.canFinance && eye.hidden;
  const open = o ? o.recent.filter((t) => !o.waiting.some((w) => w.id === t.id)) : [];
  const nothing = o && !o.waiting.length && !o.toPay.length && !o.recent.length;
  const nextCharge = o?.canFinance && !toPay.length ? o.nextCharge : null;
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
      <Stack.Screen
        options={{
          title: firstName ? `Olá, ${firstName}` : "Início",
          headerRight: o?.canFinance
            ? () => (
                <HeaderIconButton
                  symbol={eye.hidden ? "eye.slash" : "eye"}
                  label={eye.hidden ? "Mostrar valores" : "Esconder valores"}
                  onPress={() => {
                    haptic.select();
                    eye.toggle();
                  }}
                />
              )
            : undefined,
        }}
      />
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
      {/* Primeiros passos: above everything that waits for the person; draws nothing once done or hidden. */}
      <FirstStepsCard />
      {waiting.length > 0 || toPay.length > 0 ? (
        <Block index={0}>
          <AttentionCard waiting={waiting} toPay={toPay} hideMoney={hideMoney} />
        </Block>
      ) : null}
      {o && !pending ? (
        <Block index={1}>
          <AttentionList attention={o.attention} />
        </Block>
      ) : null}
      {o?.banks.length ? (
        <Block index={2}>
          <View style={{ gap: space.md }}>
            {o.banks.map((bank) => (
              <HoursBankCard key={bank.companyId} bank={bank} showCompany={o.banks.length > 1} />
            ))}
          </View>
        </Block>
      ) : null}
      {o && !pending && push.show ? (
        <Block index={3}>
          <PushCard onEnable={push.enable} onDismiss={push.dismiss} />
        </Block>
      ) : null}
      {waiting.length > 0 ? (
        <Block index={4}>
          <SectionHeader
            title="Aguardando você"
            count={waiting.length}
            action={{ label: "Ver todos", onPress: () => router.push({ pathname: "/chamados", params: { status: "waiting_customer" } }) }}
          />
          <Section>
            {waiting.slice(0, PREVIEW).map((t) => (
              <TicketCard key={t.id} ticket={t} showCompany={showCompany} />
            ))}
          </Section>
        </Block>
      ) : null}
      {toPay.length > 0 ? (
        <Block index={5}>
          <SectionHeader title="A pagar" count={toPay.length} action={{ label: "Ver todos", onPress: () => router.push("/financeiro") }} />
          <Section>
            {toPay.slice(0, PREVIEW).map((i) => (
              <InvoiceCard key={i.id} invoice={i} showCompany={showCompany} hideMoney={hideMoney} />
            ))}
          </Section>
        </Block>
      ) : nextCharge && !nothing ? (
        <Block index={5}>
          <Card style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <StatusTile icon="checkmark.circle.fill" tone="good" />
            <View
              accessible
              accessibilityLabel={`Nada a pagar agora. ${nextChargeText(nextCharge, hideMoney, true)}`}
              style={{ flex: 1, gap: space.xs }}
            >
              <Text variant="headline">Nada a pagar agora</Text>
              <Text variant="subhead" tone="muted">
                {nextChargeText(nextCharge, hideMoney)}
              </Text>
            </View>
          </Card>
        </Block>
      ) : null}
      {open.length > 0 ? (
        <Block index={6}>
          <SectionHeader title="Chamados em aberto" count={open.length} action={{ label: "Ver todos", onPress: () => router.push("/chamados") }} />
          <Section>
            {open.slice(0, PREVIEW).map((t) => (
              <TicketCard key={t.id} ticket={t} showCompany={showCompany} />
            ))}
          </Section>
        </Block>
      ) : null}
      {o?.projects.length ? (
        <Block index={7}>
          <SectionHeader title="Projetos" action={{ label: "Ver todos", onPress: () => router.push("/projetos") }} />
          <Section>
            {o.projects.map((p) => (
              <RecordRow
                key={p.id}
                kind="project"
                title={p.name}
                status={p.status !== "active" ? { label: p.statusLabel, tone: "attention" } : undefined}
                details={showCompany ? p.company : undefined}
                note={p.tasks.total ? `${p.tasks.done} de ${p.tasks.total} tarefas concluídas` : "Sem tarefas ainda"}
                onPress={() => router.push({ pathname: "/projetos/[id]", params: { id: p.id } })}
              >
                {p.tasks.total ? <Progress done={p.tasks.done} total={p.tasks.total} /> : null}
              </RecordRow>
            ))}
          </Section>
        </Block>
      ) : null}
      {o?.products.length ? (
        <Block index={8}>
          <SectionHeader title="Produtos e serviços" action={{ label: "Ver todos", onPress: () => router.push("/produtos") }} />
          <Section>
            {o.products.map((p) => {
              const detail = [p.status === "suspended" ? "Suspenso" : null, p.kind === "product" ? "Produto" : "Serviço", showCompany ? p.company : null]
                .filter(Boolean)
                .join(" · ");
              return (
                <ListRow
                  key={p.id}
                  leading={<ProductIcon path={p.iconPath} name={p.name} />}
                  title={p.name}
                  subtitle={
                    <Text variant="subhead" tone={p.status === "suspended" ? "destructive" : "muted"} numberOfLines={1}>
                      {detail}
                    </Text>
                  }
                  trailing={p.opensAs === "link" && p.status !== "suspended" && !p.mailCompanyId ? "external" : "chevron"}
                  accessibilityLabel={`${p.name}, ${detail}`}
                  onPress={() => openProduct(p)}
                />
              );
            })}
          </Section>
        </Block>
      ) : null}
      {o?.bookmarks.length ? (
        <Block index={9}>
          <SectionHeader title="Arquivos" action={{ label: "Ver todos", onPress: () => router.push("/bookmarks") }} />
          <Section>
            {o.bookmarks.map((b) => {
              const where = [b.kind === "board" ? "Lousa" : b.kind === "link" ? hostOf(b.url) : b.fileName, b.folder].filter(Boolean).join(" · ");
              return (
                <ListRow
                  key={b.id}
                  leading={
                    // A file shows its picture (or its kind), as in Arquivos.
                    b.kind === "file" ? (
                      <FileThumb item={b} />
                    ) : (
                      <IconTile icon={b.kind === "board" ? "scribble.variable" : "bookmark.fill"} color="gray" />
                    )
                  }
                  title={b.title}
                  subtitle={where || undefined}
                  trailing={b.kind === "link" ? "external" : "chevron"}
                  // A file opens in the viewer, among the files shown here.
                  onPress={() => (b.kind === "file" ? openFileViewer(b, o.bookmarks) : void openBookmark(b))}
                />
              );
            })}
          </Section>
        </Block>
      ) : null}
      {o && !pending ? (
        // The areas outside the tab bar; contracts and quotes only for whoever sees the money.
        <Block index={10}>
          <SectionHeader title="Atalhos" />
          <Section>
            <ListRow
              leading={<IconTile icon={recordLooks.project.icon} color={recordLooks.project.color} />}
              title="Projetos"
              subtitle="Quadros e entregas"
              onPress={() => router.push("/projetos")}
            />
            <ListRow
              leading={<IconTile icon="shippingbox.fill" color="green" />}
              title="Produtos e serviços"
              subtitle="O que sua empresa tem com a Anuntech"
              onPress={() => router.push("/produtos")}
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
              title="Arquivos"
              subtitle="Arquivos, links e lousas"
              onPress={() => router.push("/bookmarks")}
            />
          </Section>
        </Block>
      ) : null}
      {nothing && !pending ? (
        <Block index={11}>
          <Card raised style={{ alignItems: "center", paddingVertical: space.block }}>
            <SymbolView name="checkmark.seal.fill" size={44} tintColor={palette.success} accessible={false} />
            <Text variant="heading" accessibilityRole="header" style={{ textAlign: "center" }}>
              Tudo em dia
            </Text>
            <Text
              variant="subhead"
              tone="muted"
              accessibilityLabel={`Nenhum chamado em aberto e nada a pagar agora.${nextCharge ? ` ${nextChargeText(nextCharge, hideMoney, true)}` : ""}`}
              style={{ textAlign: "center" }}
            >
              Nenhum chamado em aberto e nada a pagar agora.{nextCharge ? ` ${nextChargeText(nextCharge, hideMoney)}` : ""}
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
