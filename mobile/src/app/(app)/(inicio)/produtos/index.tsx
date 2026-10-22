import { useDeferredValue, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, View } from "react-native";
import { Stack } from "expo-router";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/empty-state";
import { ListRow } from "@/components/list-row";
import { Pill } from "@/components/pill";
import { ProductIcon } from "@/components/product-icon";
import { GroupSeparator, groupedItem } from "@/components/section";
import { Segmented } from "@/components/segmented";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { SuspensionCard } from "@/components/suspension-card";
import { Text } from "@/components/text";
import { api, errorMessage } from "@/lib/api";
import { civilDate, money } from "@/lib/format";
import { useTabBarSpace } from "@/lib/layout";
import { engagementTone, intervalSuffix } from "@/lib/products";
import { openProduct } from "@/lib/product-open";
import { space, usePalette } from "@/lib/theme";

type Status = "active" | "paused" | "completed" | "all";
const statuses: Status[] = ["active", "paused", "completed", "all"];
const labels = ["Ativos", "Pausados", "Concluídos", "Todas"];
type Row = Awaited<ReturnType<typeof api.products.list>>["rows"][number];

/** The host of a product's link ("loja.com.br"), for the line under its name. */
const hostOf = (url: string) => url.replace(/^[a-z]+:\/\//i, "").split(/[/?#]/)[0].replace(/^www\./, "");

/** One line under the name, as the web: the item's description, else where it lives. */
function lineOf(row: Row) {
  const description = row.description?.trim();
  if (description) return description;
  if (row.kind === "service") return "Serviço da Anuntech";
  return row.url ? hostOf(row.url) : "Produto da Anuntech";
}

/**
 * Produtos e serviços (products.list): what each company has with Anuntech,
 * with the situation filter when something is paused or closed, the header's
 * search, the suspension notice and, for Administradores, price and due date.
 * A service opens its screen; a product its app or its link.
 */
export default function Products() {
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const [status, setStatus] = useState<Status>("active");
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search.trim());
  const list = useInfiniteQuery({
    queryKey: ["products", status, deferred],
    queryFn: ({ pageParam }) => api.products.list({ status, search: deferred, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pageCount ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
  const loading = useDelayed(list.isPending);
  const first = list.data?.pages[0];
  const rows = list.data?.pages.flatMap((page) => page.rows) ?? [];
  const showFilter = !!first?.showStatusFilter || status !== "active";
  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: first?.showCompany ? "Buscar por nome ou empresa" : "Buscar por nome",
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
        refreshControl={<RefreshControl refreshing={list.isRefetching && !list.isPlaceholderData} onRefresh={() => void list.refetch()} />}
        onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && void list.fetchNextPage()}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          first?.suspended || showFilter || list.error ? (
            <View style={{ gap: space.lg, paddingHorizontal: space.gutter, marginBottom: space.lg }}>
              {first?.suspended ? <SuspensionCard notice={first.suspended} /> : null}
              {showFilter ? (
                <Segmented
                  values={labels}
                  selectedIndex={statuses.indexOf(status)}
                  onChange={(index) => setStatus(statuses[index])}
                  accessibilityLabel="Filtrar por situação"
                />
              ) : null}
              {list.error ? <Notice kind="error">{errorMessage(list.error)}</Notice> : null}
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          list.isPending ? (
            loading ? <SkeletonRows /> : undefined
          ) : list.error ? undefined : deferred ? (
            <EmptyState icon="magnifyingglass" title="Nada encontrado" text="Tente outra palavra." />
          ) : (
            <EmptyState icon="shippingbox" title="Nenhum produto ou serviço" text="Os produtos e serviços contratados aparecem aqui." />
          )
        }
        ListFooterComponent={
          list.isFetchingNextPage ? <ActivityIndicator style={{ marginTop: space.lg }} accessibilityLabel="Carregando mais" /> : undefined
        }
        ItemSeparatorComponent={GroupSeparator}
        renderItem={({ item, index }) => {
          const price = item.money?.amountCents != null ? `${money(item.money.amountCents)}${intervalSuffix(item.money.interval)}` : undefined;
          const due = item.money?.nextDueDate ? `Vence em ${civilDate(item.money.nextDueDate)}` : null;
          const meta = [first?.showCompany ? item.company : null, due].filter(Boolean).join(" · ");
          const opens = item.opensAs !== "none" || item.status === "suspended";
          return (
            <View style={[groupedItem(palette, index, rows.length), { opacity: list.isPlaceholderData ? 0.6 : 1 }]}>
              <ListRow
                leading={<ProductIcon path={item.iconPath} name={item.name} size={40} />}
                title={
                  <Text variant="headline" numberOfLines={2}>
                    {item.name}
                  </Text>
                }
                subtitle={lineOf(item)}
                meta={
                  item.status !== "active" || meta ? (
                    <View style={{ marginTop: 4, gap: 6 }}>
                      {item.status !== "active" ? <Pill label={item.statusLabel} tone={engagementTone(item.status)} /> : null}
                      {meta ? (
                        <Text variant="caption" tone="muted" numberOfLines={1}>
                          {meta}
                        </Text>
                      ) : null}
                    </View>
                  ) : undefined
                }
                value={price}
                money={!!price}
                trailing={!opens ? "none" : item.opensAs === "link" && item.status !== "suspended" ? "external" : "chevron"}
                accessibilityLabel={[item.name, item.status !== "active" ? item.statusLabel : null, lineOf(item), first?.showCompany ? item.company : null, price, due, opens ? null : "Link em breve"]
                  .filter(Boolean)
                  .join(", ")}
                onPress={opens ? () => openProduct(item) : undefined}
              />
            </View>
          );
        }}
      />
    </>
  );
}
