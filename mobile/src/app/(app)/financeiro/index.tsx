import { useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Text } from "@/components/text";
import { Chip } from "@/components/chip";
import { Notice } from "@/components/surface";
import { InvoiceCard } from "@/components/invoice-card";
import { api, errorMessage } from "@/lib/api";
import { money } from "@/lib/format";
import { space, usePalette } from "@/lib/theme";
import { useTabBarSpace } from "@/lib/layout";

type Filter = "issued" | "overdue" | "paid" | "all";
const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "issued", label: "Em aberto" },
  { value: "overdue", label: "Vencidas" },
  { value: "paid", label: "Pagas" },
];

/** The company's invoices (finance.list), with the totals of each situation. */
export default function Invoices() {
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const [filter, setFilter] = useState<Filter>("all");
  const list = useInfiniteQuery({
    queryKey: ["invoices", filter],
    queryFn: ({ pageParam }) => api.finance.list({ status: filter, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pageCount ? last.page + 1 : undefined),
  });
  const first = list.data?.pages[0];
  const rows = list.data?.pages.flatMap((page) => page.rows) ?? [];
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: palette.background }}>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: bottom }}
        scrollIndicatorInsets={{ bottom }}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
        onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && void list.fetchNextPage()}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={{ gap: space.lg, marginBottom: space.sm }}>
            <Text variant="title" accessibilityRole="header" style={{ marginTop: space.lg }}>
              Faturas
            </Text>
            {first && (
              <View style={{ flexDirection: "row", gap: space.md }}>
                <View style={{ flex: 1 }}>
                  <Text variant="caption" tone="muted">
                    Em aberto
                  </Text>
                  <Text variant="heading" style={{ fontVariant: ["tabular-nums"] }}>
                    {money(first.totals.issued.cents)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="caption" tone="muted">
                    Vencidas
                  </Text>
                  <Text
                    variant="heading"
                    tone={first.totals.overdue.cents ? "destructive" : "foreground"}
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {money(first.totals.overdue.cents)}
                  </Text>
                </View>
              </View>
            )}
            <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {filters.map((f) => (
                <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
              ))}
            </View>
            {list.error && <Notice kind="error">{errorMessage(list.error)}</Notice>}
          </View>
        }
        ListEmptyComponent={
          list.isPending ? (
            <ActivityIndicator accessibilityLabel="Carregando" />
          ) : !list.error ? (
            <Text tone="muted" style={{ textAlign: "center", marginTop: space.block }}>
              Nenhuma fatura aqui.
            </Text>
          ) : undefined
        }
        ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator /> : undefined}
        renderItem={({ item }) => <InvoiceCard invoice={item} showCompany={first?.showCompany} />}
      />
    </SafeAreaView>
  );
}
