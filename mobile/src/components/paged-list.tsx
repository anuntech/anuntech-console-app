import type { ReactElement } from "react";
import { ActivityIndicator, FlatList, RefreshControl, View } from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { errorMessage } from "@/lib/api";
import { useTabBarSpace } from "@/lib/layout";
import { space, usePalette } from "@/lib/theme";
import { EmptyState, type Empty } from "./empty-state";
import { GroupSeparator, groupedItem } from "./section";
import { SkeletonRows, useDelayed } from "./skeleton";
import { Notice } from "./surface";

type Page<T> = { rows: T[]; page: number; pageCount: number; showCompany: boolean };

/**
 * A list the API serves 25 at a time, drawn as one grouped section: pull to
 * refresh, the next page as it scrolls, placeholder rows while it loads and
 * what an empty list means when there is nothing.
 */
export function PagedList<T extends { id: string }>({
  queryKey,
  load,
  render,
  empty,
  header,
}: {
  queryKey: unknown[];
  load: (page: number) => Promise<Page<T>>;
  render: (row: T, showCompany: boolean) => ReactElement;
  empty: Empty;
  header?: ReactElement;
}) {
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const list = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => load(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pageCount ? last.page + 1 : undefined),
  });
  const loading = useDelayed(list.isPending);
  const showCompany = list.data?.pages[0]?.showCompany ?? false;
  const rows = list.data?.pages.flatMap((page) => page.rows) ?? [];
  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.id}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingTop: space.sm, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
      refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
      onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && void list.fetchNextPage()}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        header || list.error ? (
          <View style={{ marginHorizontal: space.gutter, marginBottom: space.lg, gap: space.md }}>
            {header}
            {list.error ? <Notice kind="error">{errorMessage(list.error)}</Notice> : null}
          </View>
        ) : undefined
      }
      ListEmptyComponent={
        list.isPending ? (
          loading ? <SkeletonRows /> : undefined
        ) : !list.error ? (
          <EmptyState {...empty} />
        ) : undefined
      }
      ListFooterComponent={
        list.isFetchingNextPage ? <ActivityIndicator accessibilityLabel="Carregando mais" style={{ paddingVertical: space.lg }} /> : undefined
      }
      ItemSeparatorComponent={GroupSeparator}
      renderItem={({ item, index }) => <View style={groupedItem(palette, index, rows.length)}>{render(item, showCompany)}</View>}
    />
  );
}
