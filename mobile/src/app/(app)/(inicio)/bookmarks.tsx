import { useDeferredValue, useState } from "react";
import { Alert, FlatList, RefreshControl, ScrollView, View } from "react-native";
import { Stack } from "expo-router";
import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import * as WebBrowser from "expo-web-browser";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Chip } from "@/components/chip";
import { EmptyState } from "@/components/empty-state";
import { ListRow } from "@/components/list-row";
import { GroupSeparator, groupedItem } from "@/components/section";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { api, errorMessage } from "@/lib/api";
import { openAttachment } from "@/lib/files";
import { useTabBarSpace } from "@/lib/layout";
import { rounded, space, usePalette } from "@/lib/theme";

type Item = Awaited<ReturnType<typeof api.bookmarks.list>>["items"][number];

const kindLabels = { link: "Link", file: "Arquivo", board: "Lousa" } as const;

/** The site's address without the scheme and path ("console.anuntech.com"). */
function hostOf(url: string | null) {
  if (!url) return null;
  return url.replace(/^[a-z]+:\/\//i, "").split(/[/?#]/)[0] || null;
}

/** Opens what a bookmark points at: a link in the browser, a file or a board's picture in the share sheet. */
async function open(item: Item) {
  try {
    if (item.kind === "link" && item.url) await WebBrowser.openBrowserAsync(item.url);
    else if (item.filePath) await openAttachment(item.filePath, item.kind === "board" ? `${item.title}.png` : item.fileName ?? item.title);
    else Alert.alert("Abra no Console", "Esta lousa ainda não tem imagem para ver no app.");
  } catch {
    Alert.alert("Não foi possível abrir", "Confira a internet e tente de novo.");
  }
}

/** The leading tile: the site's icon for links (a link symbol when it has none), a symbol for files and boards. */
function BookmarkIcon({ item }: { item: Item }) {
  const palette = usePalette();
  const host = item.kind === "link" ? hostOf(item.url) : null;
  const [failed, setFailed] = useState(false);
  return (
    <View
      accessible={false}
      style={{ width: 32, height: 32, ...rounded(8), backgroundColor: palette.secondary, alignItems: "center", justifyContent: "center" }}
    >
      {host && !failed ? (
        <Image
          source={{ uri: `https://icons.duckduckgo.com/ip3/${host}.ico` }}
          style={{ width: 20, height: 20 }}
          contentFit="contain"
          cachePolicy="disk"
          accessible={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <SymbolView
          name={item.kind === "file" ? "doc.fill" : item.kind === "board" ? "scribble.variable" : "link"}
          size={15}
          tintColor={palette.primary}
          accessible={false}
        />
      )}
    </View>
  );
}

/** The person's bookmarks: folders as chips, the header's search, and each link, file or board (bookmarks.list). */
export default function Bookmarks() {
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const [folder, setFolder] = useState("all");
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search.trim());
  const list = useQuery({
    queryKey: ["bookmarks", folder, deferred],
    queryFn: () => api.bookmarks.list({ folder, search: deferred }),
    placeholderData: keepPreviousData,
  });
  const loading = useDelayed(list.isPending);
  const folders = list.data?.folders ?? [];
  const names = new Map(folders.map((f) => [f.id, f.name]));
  const items = list.data?.items ?? [];
  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: "Buscar nos bookmarks",
            hideWhenScrolling: false,
            autoCapitalize: "none",
            onChangeText: (e) => setSearch(e.nativeEvent.text),
          },
        }}
      />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: space.sm, paddingBottom: bottom }}
        scrollIndicatorInsets={{ bottom }}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
        ListHeaderComponent={
          folders.length > 0 || list.error ? (
            <View style={{ gap: space.md, marginBottom: space.lg }}>
              {folders.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.gutter, paddingVertical: 4 }}
                >
                  <Chip label="Todos" group="Pastas" selected={folder === "all"} onPress={() => setFolder("all")} />
                  {folders.map((f) => (
                    <Chip
                      key={f.id}
                      label={`${f.name} · ${f.count}`}
                      group="Pastas"
                      selected={folder === f.id}
                      onPress={() => setFolder(f.id)}
                    />
                  ))}
                </ScrollView>
              ) : null}
              {list.error ? (
                <View style={{ marginHorizontal: space.gutter }}>
                  <Notice kind="error">{errorMessage(list.error)}</Notice>
                </View>
              ) : null}
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          list.isPending ? (
            loading ? <SkeletonRows /> : undefined
          ) : list.error ? undefined : deferred ? (
            <EmptyState icon="magnifyingglass" title="Nada encontrado" text="Tente outra palavra." />
          ) : (
            <EmptyState icon="bookmark" title="Nenhum bookmark ainda" text="Links e arquivos salvos no Console aparecem aqui." />
          )
        }
        ItemSeparatorComponent={GroupSeparator}
        renderItem={({ item, index }) => {
          const host = item.kind === "link" ? hostOf(item.url) : null;
          const where = folder === "all" && item.folderId ? names.get(item.folderId) : null;
          return (
            <View style={[groupedItem(palette, index, items.length), { opacity: list.isPlaceholderData ? 0.6 : 1 }]}>
              <ListRow
                leading={<BookmarkIcon item={item} />}
                title={item.title}
                subtitle={
                  where || host ? (
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {[where, host].filter(Boolean).join(" · ")}
                    </Text>
                  ) : undefined
                }
                trailing={item.kind === "link" ? "external" : "chevron"}
                accessibilityLabel={[item.title, kindLabels[item.kind], where, host].filter(Boolean).join(", ")}
                onPress={() => void open(item)}
              />
            </View>
          );
        }}
      />
    </>
  );
}
