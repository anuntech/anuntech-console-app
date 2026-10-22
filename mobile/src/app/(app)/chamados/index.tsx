import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, View } from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Stack, router } from "expo-router";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/empty-state";
import { GroupSeparator, groupedItem } from "@/components/section";
import { Segmented } from "@/components/segmented";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { TicketCard } from "@/components/ticket-card";
import { api, errorMessage } from "@/lib/api";
import { HeaderIconButton } from "@/lib/stack";
import { space, usePalette } from "@/lib/theme";

const filters = ["active", "all"] as const;

/** The tickets the person sees (tickets.list), open ones first, 25 at a time. */
export default function Tickets() {
  const palette = usePalette();
  const [filter, setFilter] = useState<(typeof filters)[number]>("active");
  const list = useInfiniteQuery({
    queryKey: ["tickets", filter],
    queryFn: ({ pageParam }) => api.tickets.list({ status: filter, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pageCount ? last.page + 1 : undefined),
    // Switching the filter keeps the old rows (dimmed) until the new ones arrive.
    placeholderData: keepPreviousData,
  });
  const first = list.data?.pages[0];
  const rows = list.data?.pages.flatMap((page) => page.rows) ?? [];
  const switching = list.isPlaceholderData;
  const loading = useDelayed(list.isPending || (switching && rows.length === 0));
  const dim = useSharedValue(1);
  useEffect(() => {
    dim.set(withTiming(switching ? 0.6 : 1, { duration: 150, reduceMotion: ReduceMotion.System }));
  }, [switching, dim]);
  const dimmed = useAnimatedStyle(() => ({ opacity: dim.value }));
  const create = () => router.push("/chamados/novo");
  return (
    <>
      <Stack.Screen
        options={{
          headerRight: first?.canCreate
            ? () => <HeaderIconButton symbol="square.and.pencil" label="Abrir chamado" tint="primary" testID="new-ticket" onPress={create} />
            : undefined,
        }}
      />
      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        style={{ flex: 1, backgroundColor: palette.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: space.block }}
        refreshControl={
          <RefreshControl refreshing={list.isRefetching && !switching} onRefresh={() => void list.refetch()} />
        }
        onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && void list.fetchNextPage()}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: space.gutter, paddingTop: space.sm, marginBottom: space.lg, gap: space.lg }}>
            <Segmented
              values={["Em aberto", "Todos"]}
              selectedIndex={filters.indexOf(filter)}
              onChange={(index) => setFilter(filters[index] ?? "active")}
              accessibilityLabel="Mostrar chamados"
            />
            {list.error && <Notice kind="error">{errorMessage(list.error)}</Notice>}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <SkeletonRows />
          ) : list.isPending || switching || list.error ? undefined : filter === "active" ? (
            <EmptyState
              icon="checkmark.bubble"
              title="Nenhum chamado em aberto"
              text="Precisa de algo? Abra um chamado e a equipe responde por aqui."
              action={first?.canCreate ? { label: "Abrir chamado", icon: "square.and.pencil", onPress: create } : undefined}
            />
          ) : (
            <EmptyState
              icon="bubble.left.and.bubble.right"
              title="Nenhum chamado ainda"
              text="Abra um chamado quando precisar da equipe da Anuntech."
              action={first?.canCreate ? { label: "Abrir chamado", icon: "square.and.pencil", onPress: create } : undefined}
            />
          )
        }
        ItemSeparatorComponent={GroupSeparator}
        ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={{ marginTop: space.lg }} /> : undefined}
        renderItem={({ item, index }) => (
          <View style={groupedItem(palette, index, rows.length)}>
            {/* Only the content dims, so the white group stays whole. */}
            <Animated.View style={dimmed}>
              <TicketCard ticket={item} showCompany={first?.showCompany} />
            </Animated.View>
          </View>
        )}
      />
    </>
  );
}
