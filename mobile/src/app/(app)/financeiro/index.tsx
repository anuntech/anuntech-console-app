import { useDeferredValue, useRef, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, useWindowDimensions, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import type { SearchBarCommands } from "react-native-screens";
import { Text } from "@/components/text";
import { Card, Notice } from "@/components/surface";
import { Chip } from "@/components/chip";
import { InvoiceCard } from "@/components/invoice-card";
import { ListRow } from "@/components/list-row";
import { PressableScale } from "@/components/pressable-scale";
import { GroupSeparator, Section, groupedItem } from "@/components/section";
import { SectionHeader } from "@/components/section-header";
import { Segmented } from "@/components/segmented";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { EmptyState, type Empty } from "@/components/empty-state";
import { IconTile, StatusTile } from "@/components/tile";
import { api, errorMessage } from "@/lib/api";
import { civilDate, money } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import type { StatusLook } from "@/lib/status";
import { space, usePalette } from "@/lib/theme";
import { useTabBarSpace } from "@/lib/layout";

type Filter = "all" | "issued" | "overdue" | "paid";
type Period = "all" | "this_month" | "last_month" | "next_30" | "this_year";
type Upcoming = Awaited<ReturnType<typeof api.finance.list>>["upcoming"][number];
const filters: Filter[] = ["all", "issued", "overdue", "paid"];
const labels = ["Todas", "Em aberto", "Vencidas", "Pagas"];
const listTitles: Record<Filter, string> = { all: "Faturas", issued: "Em aberto", overdue: "Vencidas", paid: "Pagas" };
// The web's period picker (lib/billing/invoice-table.ts), without "Personalizado".
const periods: { value: Period; label: string }[] = [
  { value: "all", label: "Todo o período" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "next_30", label: "Próximos 30 dias" },
  { value: "this_year", label: "Este ano" },
];
/** Next charges shown before "Ver mais", as on the web. */
const SHOWN = 4;

const empty: Record<Filter, Empty> = {
  all: {
    icon: "checkmark.seal",
    title: "Nada a pagar",
    text: "As faturas da sua empresa aparecem aqui quando forem emitidas.",
  },
  issued: { icon: "checkmark.seal", title: "Nada em aberto", text: "Nenhuma fatura espera pagamento agora." },
  overdue: { icon: "checkmark.seal", title: "Nenhuma fatura vencida", text: "Tudo pago em dia." },
  paid: { icon: "doc.text", title: "Nenhuma fatura paga ainda", text: "As faturas pagas aparecem aqui." },
};

const faturas = (count: number) => (count === 1 ? "1 fatura" : `${count} faturas`);

/** One of the totals on top, with its count; tapping it filters the list to that situation (again, back to all). */
function Total({
  label,
  cents,
  count,
  look,
  danger,
  selected,
  wide,
  onPress,
}: {
  label: string;
  cents: number;
  count: number;
  look: StatusLook;
  danger?: boolean;
  selected: boolean;
  /** Takes the whole row: the third card on a phone, or every card under large text. */
  wide: boolean;
  onPress: () => void;
}) {
  const palette = usePalette();
  return (
    <PressableScale
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${money(cents)}, ${faturas(count)}`}
      accessibilityHint={selected ? "Mostra todas as faturas" : "Mostra só essas faturas"}
      accessibilityState={{ selected }}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={wide ? { width: "100%" } : { flexGrow: 1, flexBasis: "40%" }}
    >
      <Card raised style={{ padding: 14, gap: space.sm, ...(selected ? { borderWidth: 1.5, borderColor: palette.primary } : {}) }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <StatusTile icon={look.icon} tone={look.tone} size={28} />
          <Text variant="caption" tone={danger ? "destructive" : "muted"} numberOfLines={1} style={{ flex: 1 }}>
            {label}
          </Text>
        </View>
        <Text
          variant="money"
          tone={danger ? "destructive" : "foreground"}
          maxFontSizeMultiplier={1.5}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={{ fontSize: 24, lineHeight: 30 }}
        >
          {money(cents)}
        </Text>
        <Text variant="caption" tone="muted">
          {faturas(count)}
        </Text>
      </Card>
    </PressableScale>
  );
}

/** "Próximas cobranças": what each recurrence charges next, before the invoice exists (web: upcoming-charges.tsx). */
function UpcomingCharges({ charges, showCompany }: { charges: Upcoming[]; showCompany: boolean }) {
  const [all, setAll] = useState(false);
  const shown = all ? charges : charges.slice(0, SHOWN);
  const rest = charges.length - SHOWN;
  return (
    <Section header="Próximas cobranças" footer="Você recebe o aviso por e-mail e WhatsApp 5 dias antes de cada vencimento.">
      {shown.map((charge) => {
        const due = `Vence em ${civilDate(charge.dueDate)}`;
        const arrives = `Boleto e Pix chegam até ${civilDate(charge.issueDate)}.`;
        return (
          <ListRow
            key={charge.subscriptionId}
            leading={<IconTile icon="calendar" color="gray" />}
            title={charge.description}
            subtitle={`${due} · ${arrives}`}
            meta={showCompany ? charge.company : undefined}
            value={money(charge.amountCents)}
            money
            valueTone="foreground"
            accessibilityLabel={[charge.description, money(charge.amountCents), due, arrives, showCompany ? charge.company : null].filter(Boolean).join(". ")}
            accessibilityHint={charge.invoiceId ? "Abre a última fatura desta recorrência" : undefined}
            onPress={
              charge.invoiceId
                ? () => router.push({ pathname: "/financeiro/[id]", params: { id: charge.invoiceId! } })
                : undefined
            }
          />
        );
      })}
      {rest > 0 ? (
        <ListRow
          key="more"
          title={all ? "Ver menos" : `Ver mais ${rest}`}
          tone="primary"
          trailing="none"
          onPress={() => {
            haptic.select();
            setAll(!all);
          }}
        />
      ) : null}
    </Section>
  );
}

/** The company's invoices (finance.list): totals with counts, search, period, next charges and the list. */
export default function Invoices() {
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const { fontScale, width } = useWindowDimensions();
  const stacked = fontScale > 1.3 || width < 340;
  const searchBar = useRef<SearchBarCommands>(null);
  // A link may open the list filtered ("Pagar agora" on a suspended product: /financeiro?status=overdue).
  const { status } = useLocalSearchParams<{ status?: string }>();
  const linked = filters.find((f) => f === status);
  const [filter, setFilter] = useState<Filter>(linked ?? "all");
  const [seenLink, setSeenLink] = useState(status);
  if (status !== seenLink) {
    setSeenLink(status);
    if (linked) setFilter(linked);
  }
  const [period, setPeriod] = useState<Period>("all");
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search.trim());
  const list = useInfiniteQuery({
    queryKey: ["invoices", filter, period, deferred],
    queryFn: ({ pageParam }) => api.finance.list({ status: filter, period, search: deferred, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pageCount ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
  const loading = useDelayed(list.isPending);
  const first = list.data?.pages[0];
  const rows = list.data?.pages.flatMap((page) => page.rows) ?? [];
  const overdue = first?.totals.overdue;
  const filtered = !!deferred || period !== "all";
  const pick = (next: Filter) => setFilter(filter === next ? "all" : next);
  const clear = () => {
    searchBar.current?.clearText();
    setSearch("");
    setPeriod("all");
    setFilter("all");
  };
  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            ref: searchBar,
            placeholder: "Buscar por descrição ou empresa",
            hideWhenScrolling: false,
            onChangeText: (e) => setSearch(e.nativeEvent.text),
          },
        }}
      />
      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: space.sm, paddingBottom: bottom }}
        scrollIndicatorInsets={{ bottom }}
        style={{ backgroundColor: palette.background }}
        refreshControl={<RefreshControl refreshing={list.isRefetching && !list.isPlaceholderData} onRefresh={() => void list.refetch()} />}
        onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && void list.fetchNextPage()}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={{ gap: space.lg, marginBottom: space.sm }}>
            {first && overdue && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md, paddingHorizontal: space.gutter }}>
                <Total
                  label="Em aberto"
                  cents={first.totals.issued.cents}
                  count={first.totals.issued.count}
                  look={{ tone: "info", icon: "clock.fill" }}
                  selected={filter === "issued"}
                  wide={stacked}
                  onPress={() => pick("issued")}
                />
                <Total
                  label="Vencidas"
                  cents={overdue.cents}
                  count={overdue.count}
                  look={{ tone: "danger", icon: "exclamationmark.triangle.fill" }}
                  danger={overdue.count > 0}
                  selected={filter === "overdue"}
                  wide={stacked}
                  onPress={() => pick("overdue")}
                />
                <Total
                  label="Pagas"
                  cents={first.totals.paid.cents}
                  count={first.totals.paid.count}
                  look={{ tone: "good", icon: "checkmark.circle.fill" }}
                  selected={filter === "paid"}
                  wide
                  onPress={() => pick("paid")}
                />
              </View>
            )}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              accessibilityLabel="Período, pelo vencimento"
              contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.gutter, paddingVertical: 4 }}
            >
              {periods.map((p) => (
                <Chip key={p.value} label={p.label} group="Período, pelo vencimento" selected={period === p.value} onPress={() => setPeriod(p.value)} />
              ))}
            </ScrollView>
            <View style={{ paddingHorizontal: space.gutter }}>
              <Segmented
                values={labels}
                selectedIndex={filters.indexOf(filter)}
                onChange={(index) => setFilter(filters[index])}
                accessibilityLabel="Filtrar faturas"
              />
            </View>
            {list.error && (
              <View style={{ paddingHorizontal: space.gutter }}>
                <Notice kind="error">{errorMessage(list.error)}</Notice>
              </View>
            )}
            {first?.upcoming.length ? (
              <View style={{ paddingHorizontal: space.gutter }}>
                <UpcomingCharges charges={first.upcoming} showCompany={first.showCompany} />
              </View>
            ) : null}
            {first && rows.length > 0 ? (
              <View style={{ paddingHorizontal: space.gutter, marginBottom: -space.sm }}>
                <SectionHeader title={listTitles[filter]} count={first.totals[filter].count} />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          list.isPending ? (
            loading ? <SkeletonRows /> : undefined
          ) : list.error ? undefined : filtered ? (
            <EmptyState
              icon="magnifyingglass"
              title="Nenhuma fatura encontrada"
              text="Tente outro termo ou mude os filtros."
              action={{ label: "Limpar filtros", onPress: clear }}
            />
          ) : (
            <EmptyState {...empty[filter]} />
          )
        }
        ItemSeparatorComponent={GroupSeparator}
        ListFooterComponent={
          list.isFetchingNextPage ? <ActivityIndicator style={{ marginTop: space.lg }} accessibilityLabel="Carregando mais" /> : undefined
        }
        renderItem={({ item, index }) => (
          <View style={[groupedItem(palette, index, rows.length), { opacity: list.isPlaceholderData ? 0.6 : 1 }]}>
            <InvoiceCard invoice={item} showCompany={first?.showCompany} />
          </View>
        )}
      />
    </>
  );
}
