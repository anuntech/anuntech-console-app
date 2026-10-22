import { useDeferredValue, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, View } from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { Chip } from "@/components/chip";
import { EmptyState } from "@/components/empty-state";
import { GroupSeparator, groupedItem } from "@/components/section";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { TicketCard } from "@/components/ticket-card";
import { api, errorMessage } from "@/lib/api";
import { useTabBarSpace } from "@/lib/layout";
import { useMe } from "@/lib/me";
import { HeaderIconButton } from "@/lib/stack";
import { space, usePalette } from "@/lib/theme";

/** The web's filters (lib/tickets/ticket-table.ts), in its order; a client reads "Aguardando você". */
const filters = ["active", "open", "in_progress", "waiting_customer", "resolved", "closed", "all"] as const;
type Filter = (typeof filters)[number];
const filterLabels: Record<Filter, string> = {
  active: "Em aberto",
  open: "Aguardando atendimento",
  in_progress: "Em atendimento",
  waiting_customer: "Aguardando você",
  resolved: "Resolvidos",
  closed: "Encerrados",
  all: "Todas as situações",
};
const isFilter = (value: unknown): value is Filter => typeof value === "string" && (filters as readonly string[]).includes(value);

/**
 * The tickets the person sees (tickets.list), open ones first, 25 at a time,
 * with the web's situations and a search by subject. `/chamados?status=waiting_customer`
 * opens with a situation chosen (Início's "Aguardando você").
 */
export default function Tickets() {
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const me = useMe();
  const params = useLocalSearchParams<{ status?: string }>();
  const [filter, setFilter] = useState<Filter>(isFilter(params.status) ? params.status : "active");
  // A new link (Início → "Aguardando você") picks its situation even with the list already open.
  const [linked, setLinked] = useState(params.status);
  if (params.status !== linked) {
    setLinked(params.status);
    if (isFilter(params.status)) setFilter(params.status);
  }
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.trim());
  const list = useInfiniteQuery({
    queryKey: ["tickets", filter, query],
    queryFn: ({ pageParam }) => api.tickets.list({ status: filter, search: query, page: pageParam }),
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
  const label = (value: Filter) => (value === "waiting_customer" && me.data?.staff ? "Aguardando cliente" : filterLabels[value]);
  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: "Buscar por assunto",
            hideWhenScrolling: false,
            onChangeText: (e) => setSearch(e.nativeEvent.text),
          },
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
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: bottom }}
        scrollIndicatorInsets={{ bottom }}
        refreshControl={
          <RefreshControl refreshing={list.isRefetching && !switching} onRefresh={() => void list.refetch()} />
        }
        onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && void list.fetchNextPage()}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={{ paddingTop: space.sm, marginBottom: space.lg, gap: space.md }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.gutter, paddingVertical: 4 }}
            >
              {filters.map((value) => (
                <Chip key={value} label={label(value)} group="Situação" selected={filter === value} onPress={() => setFilter(value)} />
              ))}
            </ScrollView>
            {list.error && (
              <View style={{ paddingHorizontal: space.gutter }}>
                <Notice kind="error">{errorMessage(list.error)}</Notice>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <SkeletonRows />
          ) : list.isPending || switching || list.error ? undefined : query || (filter !== "active" && filter !== "all") ? (
            <EmptyState
              icon="magnifyingglass"
              title="Nenhum chamado encontrado"
              text={query ? "Tente outra palavra ou outra situação." : "Nenhum chamado nesta situação."}
              action={filter !== "active" ? { label: "Limpar filtros", onPress: () => setFilter("active") } : undefined}
            />
          ) : filter === "active" ? (
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
