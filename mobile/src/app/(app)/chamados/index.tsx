import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import { Chip } from "@/components/chip";
import { StatusBadge } from "@/components/badge";
import { Notice } from "@/components/surface";
import { api, errorMessage } from "@/lib/api";
import { when } from "@/lib/format";
import { radius, space, usePalette } from "@/lib/theme";

type Filter = "active" | "all";

/** The tickets the person sees (tickets.list), open ones first, 25 at a time. */
export default function Tickets() {
  const palette = usePalette();
  const [filter, setFilter] = useState<Filter>("active");
  const list = useInfiniteQuery({
    queryKey: ["tickets", filter],
    queryFn: ({ pageParam }) => api.tickets.list({ status: filter, page: pageParam }),
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
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.block * 2 }}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
        onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && void list.fetchNextPage()}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={{ gap: space.lg, marginBottom: space.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.lg }}>
              <Text variant="title" accessibilityRole="header">
                Chamados
              </Text>
              {first?.canCreate && (
                <Button title="Abrir chamado" testID="new-ticket" onPress={() => router.push("/chamados/novo")} />
              )}
            </View>
            <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: space.sm }}>
              <Chip label="Em aberto" selected={filter === "active"} onPress={() => setFilter("active")} />
              <Chip label="Todos" selected={filter === "all"} onPress={() => setFilter("all")} />
            </View>
            {list.error && <Notice kind="error">{errorMessage(list.error)}</Notice>}
          </View>
        }
        ListEmptyComponent={
          list.isPending ? (
            <ActivityIndicator accessibilityLabel="Carregando" />
          ) : !list.error ? (
            <Text tone="muted" style={{ textAlign: "center", marginTop: space.block }}>
              {filter === "active" ? "Nenhum chamado em aberto." : "Nenhum chamado ainda."}
            </Text>
          ) : undefined
        }
        ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator /> : undefined}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.subject}, ${item.statusLabel}`}
            onPress={() => router.push({ pathname: "/chamados/[id]", params: { id: item.id } })}
            style={({ pressed }) => ({
              backgroundColor: palette.card,
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: palette.border,
              padding: space.lg,
              gap: space.sm,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center", flexWrap: "wrap" }}>
              <StatusBadge status={item.status} label={item.statusLabel} />
              {item.kindLabel ? (
                <Text variant="caption" tone="muted">
                  {item.kindLabel}
                </Text>
              ) : null}
            </View>
            <Text variant="label" numberOfLines={2} style={{ fontSize: 16, lineHeight: 22 }}>
              {item.subject}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {[first?.showCompany ? item.company : null, item.engagement, when(item.updatedAt)]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            {item.due ? (
              <Text variant="caption" tone={item.due.late ? "destructive" : "muted"}>
                {item.due.label}
              </Text>
            ) : null}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
