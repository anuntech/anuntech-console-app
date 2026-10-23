import { useDeferredValue, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, View } from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Stack, router } from "expo-router";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { Chip } from "@/components/chip";
import { EmptyState } from "@/components/empty-state";
import { RecordRow } from "@/components/record-card";
import { GroupSeparator, groupedItem } from "@/components/section";
import { Segmented } from "@/components/segmented";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { api, errorMessage } from "@/lib/api";
import { when } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { useTabBarSpace } from "@/lib/layout";
import { useMe } from "@/lib/me";
import type { ToneName } from "@/lib/status";
import { rounded, space, usePalette } from "@/lib/theme";

const filters = ["active", "paused", "completed", "all"] as const;
type Filter = (typeof filters)[number];
const filterLabels = ["Ativos", "Pausados", "Concluídos", "Todas"];
/** Active is the normal state; only a paused, finished or suspended project says so, as on the web. */
const statusTones: Record<string, ToneName> = { paused: "attention", completed: "good", suspended: "danger" };
const emptyTexts: Record<Filter, { title: string; text: string }> = {
  active: { title: "Nenhum projeto ativo", text: "Quando a Anuntech começar um projeto com sua empresa, o quadro aparece aqui." },
  paused: { title: "Nenhum projeto pausado", text: "Projetos pausados pela equipe aparecem aqui." },
  completed: { title: "Nenhum projeto concluído", text: "Projetos entregues aparecem aqui, com o quadro completo." },
  all: { title: "Nenhum projeto ainda", text: "Quando a Anuntech começar um projeto com sua empresa, o quadro aparece aqui." },
};

/** No active project yet: ask for a quote, as the web's empty list does (`/chamados/novo?tipo=novo-projeto`). */
const askForQuote = () => {
  haptic.light();
  router.push({ pathname: "/chamados/novo", params: { kind: "new_project" } });
};

/** A thin bar with the share of the board already done (the row says it in words). */
function Progress({ done, total }: { done: number; total: number }) {
  const palette = usePalette();
  const share = total ? done / total : 0;
  return (
    <View style={{ height: 6, ...rounded(999), backgroundColor: palette.fill, overflow: "hidden" }}>
      <View style={{ width: `${Math.round(share * 100)}%`, height: 6, backgroundColor: palette.success }} />
    </View>
  );
}

/** The projects the person sees (projects.list): by situation, by name in the header's search and, with several companies, by company. */
export default function Projects() {
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const me = useMe();
  // The team creates projects on the web; asking for a quote is the client's.
  const canAsk = !!me.data && !me.data.staff;
  const [filter, setFilter] = useState<Filter>("active");
  const [company, setCompany] = useState("");
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search.trim());
  const list = useInfiniteQuery({
    queryKey: ["projects", filter, company, deferred],
    queryFn: ({ pageParam }) => api.projects.list({ status: filter, company, search: deferred, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pageCount ? last.page + 1 : undefined),
    // Switching a filter keeps the old rows (dimmed) until the new ones arrive.
    placeholderData: keepPreviousData,
  });
  const first = list.data?.pages[0];
  const rows = list.data?.pages.flatMap((page) => page.rows) ?? [];
  const companies = first?.companies ?? [];
  const switching = list.isPlaceholderData;
  const loading = useDelayed(list.isPending || (switching && rows.length === 0));
  const dim = useSharedValue(1);
  useEffect(() => {
    dim.set(withTiming(switching ? 0.6 : 1, { duration: 150, reduceMotion: ReduceMotion.System }));
  }, [switching, dim]);
  const dimmed = useAnimatedStyle(() => ({ opacity: dim.value }));
  const empty = deferred
    ? { title: "Nenhum projeto encontrado", text: "Confira o nome ou troque a situação." }
    : emptyTexts[filter];
  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: "Buscar projetos",
            hideWhenScrolling: false,
            onChangeText: (e) => setSearch(e.nativeEvent.text),
          },
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
        refreshControl={<RefreshControl refreshing={list.isRefetching && !switching} onRefresh={() => void list.refetch()} />}
        onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && void list.fetchNextPage()}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={{ paddingTop: space.sm, marginBottom: space.lg, gap: space.md }}>
            <View style={{ paddingHorizontal: space.gutter }}>
              <Segmented
                values={filterLabels}
                selectedIndex={filters.indexOf(filter)}
                onChange={(index) => setFilter(filters[index] ?? "active")}
                accessibilityLabel="Situação dos projetos"
              />
            </View>
            {companies.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.gutter, paddingVertical: 4 }}
              >
                <Chip label="Todas as empresas" group="Empresas" selected={!company} onPress={() => setCompany("")} />
                {companies.map((c) => (
                  <Chip key={c.id} label={c.name} group="Empresas" selected={company === c.id} onPress={() => setCompany(c.id)} />
                ))}
              </ScrollView>
            ) : null}
            {list.error ? (
              <View style={{ paddingHorizontal: space.gutter }}>
                <Notice kind="error">{errorMessage(list.error)}</Notice>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <SkeletonRows />
          ) : list.isPending || switching || list.error ? undefined : (
            <EmptyState
              icon="square.grid.2x2"
              title={empty.title}
              text={empty.text}
              action={
                canAsk && filter === "active" && !deferred ? { label: "Pedir orçamento", icon: "plus", onPress: askForQuote } : undefined
              }
            />
          )
        }
        ItemSeparatorComponent={GroupSeparator}
        ListFooterComponent={
          list.isFetchingNextPage ? <ActivityIndicator accessibilityLabel="Carregando mais" style={{ paddingVertical: space.lg }} /> : undefined
        }
        renderItem={({ item: p, index }) => (
          <View style={groupedItem(palette, index, rows.length)}>
            {/* Only the content dims, so the white group stays whole. */}
            <Animated.View style={dimmed}>
              <RecordRow
                kind="project"
                title={p.name}
                status={statusTones[p.status] ? { label: p.statusLabel, tone: statusTones[p.status] } : undefined}
                details={[first?.showCompany ? p.company : null, `Atualizado em ${when(p.updatedAt)}`].filter(Boolean).join(" · ")}
                note={p.tasks.total ? `${p.tasks.done} de ${p.tasks.total} tarefas concluídas` : "Sem tarefas ainda"}
                onPress={() => router.push({ pathname: "/projetos/[id]", params: { id: p.id } })}
              >
                {p.tasks.total ? <Progress done={p.tasks.done} total={p.tasks.total} /> : null}
              </RecordRow>
            </Animated.View>
          </View>
        )}
      />
    </>
  );
}
