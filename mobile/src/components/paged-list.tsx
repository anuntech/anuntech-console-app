import type { ReactElement } from "react";
import { ActivityIndicator, FlatList, RefreshControl } from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { errorMessage } from "@/lib/api";
import { useTabBarSpace } from "@/lib/layout";
import { space } from "@/lib/theme";
import { Notice } from "./surface";
import { Text } from "./text";

type Page<T> = { rows: T[]; page: number; pageCount: number; showCompany: boolean };

/** A list the API serves 25 at a time: pull to refresh, the next page as it scrolls. */
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
  empty: string;
  header?: ReactElement;
}) {
  const bottom = useTabBarSpace();
  const list = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => load(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pageCount ? last.page + 1 : undefined),
  });
  const showCompany = list.data?.pages[0]?.showCompany ?? false;
  return (
    <FlatList
      data={list.data?.pages.flatMap((page) => page.rows) ?? []}
      keyExtractor={(row) => row.id}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
      refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
      onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && void list.fetchNextPage()}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <>
          {header}
          {list.error ? <Notice kind="error">{errorMessage(list.error)}</Notice> : null}
        </>
      }
      ListEmptyComponent={
        list.isPending ? (
          <ActivityIndicator accessibilityLabel="Carregando" />
        ) : !list.error ? (
          <Text tone="muted" style={{ textAlign: "center", marginTop: space.block }}>
            {empty}
          </Text>
        ) : undefined
      }
      ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator /> : undefined}
      renderItem={({ item }) => render(item, showCompany)}
    />
  );
}
