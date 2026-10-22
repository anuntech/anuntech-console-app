import { useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, useWindowDimensions, View } from "react-native";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { Text } from "@/components/text";
import { Card, Notice } from "@/components/surface";
import { InvoiceCard } from "@/components/invoice-card";
import { PressableScale } from "@/components/pressable-scale";
import { GroupSeparator, groupedItem } from "@/components/section";
import { Segmented } from "@/components/segmented";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { EmptyState, type Empty } from "@/components/empty-state";
import { StatusTile } from "@/components/tile";
import { api, errorMessage } from "@/lib/api";
import { money } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import type { StatusLook } from "@/lib/status";
import { space, usePalette } from "@/lib/theme";
import { useTabBarSpace } from "@/lib/layout";

type Filter = "all" | "issued" | "overdue" | "paid";
const filters: Filter[] = ["all", "issued", "overdue", "paid"];
const labels = ["Todas", "Em aberto", "Vencidas", "Pagas"];

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

/** One of the two totals on top; tapping it filters the list to that situation. */
function Total({
  label,
  cents,
  look,
  danger,
  selected,
  stacked,
  onPress,
}: {
  label: string;
  cents: number;
  look: StatusLook;
  danger?: boolean;
  selected: boolean;
  /** Under large text the two totals stack, each the full width. */
  stacked: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${money(cents)}`}
      accessibilityHint="Mostra só essas faturas"
      accessibilityState={{ selected }}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={stacked ? undefined : { flex: 1 }}
    >
      <Card raised style={{ padding: 14, gap: space.sm }}>
        <StatusTile icon={look.icon} tone={look.tone} size={28} />
        <Text variant="caption" tone={danger ? "destructive" : "muted"}>
          {label}
        </Text>
        <Text
          variant="money"
          tone={danger ? "destructive" : "foreground"}
          maxFontSizeMultiplier={1.5}
          style={{ fontSize: 24, lineHeight: 30 }}
        >
          {money(cents)}
        </Text>
      </Card>
    </PressableScale>
  );
}

/** The company's invoices (finance.list), with the totals of each situation. */
export default function Invoices() {
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const stacked = useWindowDimensions().fontScale > 1.3;
  const [filter, setFilter] = useState<Filter>("all");
  const list = useInfiniteQuery({
    queryKey: ["invoices", filter],
    queryFn: ({ pageParam }) => api.finance.list({ status: filter, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pageCount ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
  const loading = useDelayed(list.isPending);
  const first = list.data?.pages[0];
  const rows = list.data?.pages.flatMap((page) => page.rows) ?? [];
  const overdue = first?.totals.overdue.cents ?? 0;
  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.id}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingTop: space.sm, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
      style={{ backgroundColor: palette.background }}
      refreshControl={<RefreshControl refreshing={list.isRefetching && !list.isPlaceholderData} onRefresh={() => void list.refetch()} />}
      onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && void list.fetchNextPage()}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <View style={{ gap: space.lg, paddingHorizontal: space.gutter, marginBottom: space.block }}>
          {first && (
            <View style={{ flexDirection: stacked ? "column" : "row", gap: space.md }}>
              <Total
                label="Em aberto"
                cents={first.totals.issued.cents}
                look={{ tone: "info", icon: "clock.fill" }}
                selected={filter === "issued"}
                stacked={stacked}
                onPress={() => setFilter("issued")}
              />
              <Total
                label="Vencidas"
                cents={overdue}
                look={{ tone: "danger", icon: "exclamationmark.triangle.fill" }}
                danger={overdue > 0}
                selected={filter === "overdue"}
                stacked={stacked}
                onPress={() => setFilter("overdue")}
              />
            </View>
          )}
          <Segmented
            values={labels}
            selectedIndex={filters.indexOf(filter)}
            onChange={(index) => setFilter(filters[index])}
            accessibilityLabel="Filtrar faturas"
          />
          {list.error && <Notice kind="error">{errorMessage(list.error)}</Notice>}
        </View>
      }
      ListEmptyComponent={
        list.isPending ? (
          loading ? <SkeletonRows /> : undefined
        ) : !list.error ? (
          <EmptyState {...empty[filter]} />
        ) : undefined
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
  );
}
