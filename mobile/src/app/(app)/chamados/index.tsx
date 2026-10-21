import { useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import { Chip } from "@/components/chip";
import { TicketCard } from "@/components/ticket-card";
import { Notice } from "@/components/surface";
import { api, errorMessage } from "@/lib/api";
import { space, usePalette } from "@/lib/theme";
import { useTabBarSpace } from "@/lib/layout";

type Filter = "active" | "all";

/** The tickets the person sees (tickets.list), open ones first, 25 at a time. */
export default function Tickets() {
  const palette = usePalette();
  const bottom = useTabBarSpace();
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
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: bottom }}
        scrollIndicatorInsets={{ bottom }}
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
        renderItem={({ item }) => <TicketCard ticket={item} showCompany={first?.showCompany} />}
      />
    </SafeAreaView>
  );
}
