import { useDeferredValue, useEffect, useState } from "react";
import { ActionSheetIOS, ActivityIndicator, Alert, FlatList, Platform, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { router, Stack } from "expo-router";
import { SymbolView } from "@/components/symbol";
import { keepPreviousData, useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { Avatar } from "@/components/avatar";
import { Chip } from "@/components/chip";
import { EmptyState } from "@/components/empty-state";
import { ListRow } from "@/components/list-row";
import { GroupSeparator, Section, groupedItem } from "@/components/section";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { IconTile } from "@/components/tile";
import { api, errorMessage } from "@/lib/api";
import {
  audience,
  bookmarksKey,
  deleteNote,
  describe,
  letterTile,
  openBookmark,
  refreshBookmarks,
  type Bookmark,
  type BookmarkFolder,
} from "@/lib/bookmarks";
import { clearFlash, showFlash, useFlash } from "@/lib/flash";
import { when } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { useTabBarSpace } from "@/lib/layout";
import { useMe } from "@/lib/me";
import { HeaderIconButton } from "@/lib/stack";
import { rounded, space, usePalette } from "@/lib/theme";

const kindLabels = { link: "Link", file: "Arquivo", board: "Lousa" } as const;
const openLabels = { link: "Abrir link", file: "Baixar arquivo", board: "Abrir lousa" } as const;

/**
 * The leading tile, as the web draws it: a link shows its host's letter on a
 * tone picked by the host (no favicon, so no saved address goes to anyone), a
 * file and a board their symbol.
 */
function BookmarkIcon({ item }: { item: Bookmark }) {
  const palette = usePalette();
  const box = { width: 32, height: 32, ...rounded(8), alignItems: "center", justifyContent: "center" } as const;
  if (item.kind === "link" && item.url) {
    const { letter, tone } = letterTile(item.url);
    // Brand and neutrals only, as the web: green, amber and red mean a state elsewhere.
    const tones = [
      { backgroundColor: palette.accent },
      { backgroundColor: palette.secondary },
      { backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border },
    ];
    return (
      <View accessible={false} style={{ ...box, ...tones[tone] }}>
        {/* The tile is fixed in size, so the letter grows only a little with the system text. */}
        <Text variant="label" tone={tone === 0 ? "primary" : "foreground"} maxFontSizeMultiplier={1.3} style={{ textTransform: "uppercase" }}>
          {letter}
        </Text>
      </View>
    );
  }
  const board = item.kind === "board";
  return (
    <View accessible={false} style={{ ...box, backgroundColor: board ? palette.accent : palette.secondary }}>
      <SymbolView
        name={board ? "scribble.variable" : item.kind === "file" ? "doc.fill" : "link"}
        size={15}
        tintColor={board ? palette.primary : palette.muted}
        accessible={false}
      />
    </View>
  );
}

/** Up to three faces of the people a folder is shared with. */
function Faces({ people }: { people: BookmarkFolder["sharedWith"] }) {
  const palette = usePalette();
  return (
    <View accessible={false} style={{ flexDirection: "row" }}>
      {people.slice(0, 3).map((p, i) => (
        <View key={p.id} style={{ marginLeft: i ? -8 : 0, borderRadius: 13, borderWidth: 2, borderColor: palette.card }}>
          <Avatar avatar={p.avatar} name={p.name} size={22} />
        </View>
      ))}
    </View>
  );
}

/**
 * The person's bookmarks, as /bookmarks on the web: companies and folders as
 * chips (with "Sem pasta"), who sees the folder open, the header's search,
 * 25 at a time, and what each person may do with each link, file or board.
 */
export default function Bookmarks() {
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const me = useMe();
  const flash = useFlash();
  useEffect(() => () => clearFlash(), []);
  const [company, setCompany] = useState("all");
  const [folder, setFolder] = useState("all");
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search.trim());
  const list = useInfiniteQuery({
    queryKey: [...bookmarksKey, company, folder, deferred],
    queryFn: ({ pageParam }) => api.bookmarks.list({ company, folder, search: deferred, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pageCount ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
  const loading = useDelayed(list.isPending);
  const first = list.data?.pages[0];
  const folders = first?.folders ?? [];
  const companies = first?.companies ?? [];
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  // A folder that went away shows everything, as the server answered.
  const shown = first?.folder ?? folder;
  const current = folders.find((f) => f.id === shown) ?? null;
  const names = new Map(folders.map((f) => [f.id, f.name]));
  const manyCompanies = companies.length > 1;
  const companyName = new Map(companies.map((c) => [c.id, c.name]));

  // A new item lands where the person is looking: the folder, or the company picked.
  const add = () => {
    clearFlash();
    router.push({
      pathname: "/bookmarks/novo",
      params: {
        folderId: current?.id ?? "",
        companyId: current?.companyId ?? (company !== "all" ? company : ""),
      },
    });
  };
  const newFolder = () => {
    clearFlash();
    router.push({ pathname: "/bookmarks/pasta", params: { companyId: company !== "all" ? company : "" } });
  };

  const done = ({ message }: { message: string }) => {
    haptic.success();
    showFlash(message);
    void refreshBookmarks();
  };
  const failed = (error: unknown) => {
    haptic.error();
    Alert.alert("Não foi possível concluir", errorMessage(error));
  };
  const removeBookmark = useMutation({ mutationFn: (id: string) => api.bookmarks.remove({ id }), onSuccess: done, onError: failed });
  const removeFolder = useMutation({
    mutationFn: (id: string) => api.bookmarks.deleteFolder({ id }),
    onSuccess: (answer) => {
      setFolder("all");
      done(answer);
    },
    onError: failed,
  });

  const askDelete = (item: Bookmark) => {
    haptic.medium();
    Alert.alert("Excluir bookmark?", `"${item.title}" sai da lista${deleteNote(item)}. Isso não pode ser desfeito.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => removeBookmark.mutate(item.id) },
    ]);
  };
  const askDeleteFolder = (f: BookmarkFolder) => {
    haptic.medium();
    Alert.alert(`Excluir “${f.name}”?`, "Os bookmarks não são apagados: continuam na empresa, em “Sem pasta”.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir pasta", style: "destructive", onPress: () => removeFolder.mutate(f.id) },
    ]);
  };
  const edit = (item: Bookmark) => {
    clearFlash();
    router.push({ pathname: "/bookmarks/[id]/editar", params: { id: item.id } });
  };
  const move = (item: Bookmark) => {
    clearFlash();
    router.push({ pathname: "/bookmarks/[id]/mover", params: { id: item.id } });
  };

  /** The web's "…" menu: open, and for who saved it or the folder's owner, edit, move and delete. */
  const actions = (item: Bookmark) => {
    if (Platform.OS === "ios") {
      const options = [openLabels[item.kind], "Editar", "Mover para", "Excluir", "Cancelar"];
      ActionSheetIOS.showActionSheetWithOptions(
        { title: item.title, options, cancelButtonIndex: 4, destructiveButtonIndex: 3 },
        (index) => {
          if (index === 0) void openBookmark(item);
          else if (index === 1) edit(item);
          else if (index === 2) move(item);
          else if (index === 3) askDelete(item);
        },
      );
      return;
    }
    // An Android dialog holds three buttons; opening is the row's own tap.
    Alert.alert(
      item.title,
      undefined,
      [
        { text: "Excluir", style: "destructive", onPress: () => askDelete(item) },
        { text: "Mover para", onPress: () => move(item) },
        { text: "Editar", onPress: () => edit(item) },
      ],
      { cancelable: true },
    );
  };

  const header = (
    <View style={{ gap: space.md, marginBottom: space.lg }}>
      {manyCompanies ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.gutter, paddingVertical: 4 }}
        >
          <Chip
            label="Todas as empresas"
            group="Empresas"
            selected={company === "all"}
            onPress={() => {
              setCompany("all");
              setFolder("all");
            }}
          />
          {companies.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              group="Empresas"
              selected={company === c.id}
              onPress={() => {
                setCompany(c.id);
                setFolder("all");
              }}
            />
          ))}
        </ScrollView>
      ) : null}
      {first ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.gutter, paddingVertical: 4 }}
        >
          <Chip label="Todos" group="Pastas" selected={shown === "all"} onPress={() => setFolder("all")} />
          <Chip label={`Sem pasta · ${first.rootCount}`} group="Pastas" selected={shown === "root"} onPress={() => setFolder("root")} />
          {folders.map((f) => (
            <Chip
              key={f.id}
              label={`${f.name}${manyCompanies && company === "all" && f.company ? ` (${f.company})` : ""} · ${f.count}`}
              group={f.visibility === "people" ? "Pastas, compartilhada com pessoas escolhidas" : "Pastas"}
              selected={shown === f.id}
              onPress={() => setFolder(f.id)}
            />
          ))}
        </ScrollView>
      ) : null}
      {current ? (
        <Section inset={space.gutter} indent={60}>
          <ListRow
            leading={<IconTile icon={current.visibility === "people" ? "person.2.fill" : "building.2.fill"} color={current.visibility === "people" ? "violet" : "teal"} />}
            title="Quem vê"
            subtitle={[audience(current, me.data?.id), manyCompanies ? current.company : null].filter(Boolean).join(" · ")}
            trailing={
              current.manages ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                  {current.sharedWith.length ? <Faces people={current.sharedWith} /> : null}
                  <SymbolView name="chevron.right" size={13} weight="semibold" tintColor={palette.tertiary} accessible={false} />
                </View>
              ) : current.sharedWith.length ? (
                <Faces people={current.sharedWith} />
              ) : (
                "none"
              )
            }
            accessibilityHint={current.manages ? "Compartilhar a pasta" : undefined}
            onPress={
              current.manages
                ? () => {
                    clearFlash();
                    router.push({ pathname: "/bookmarks/compartilhar", params: { id: current.id } });
                  }
                : undefined
            }
          />
          {current.manages ? (
            <ListRow
              leading={<IconTile icon="pencil" color="gray" />}
              title="Renomear pasta"
              onPress={() => {
                clearFlash();
                router.push({ pathname: "/bookmarks/pasta", params: { id: current.id } });
              }}
            />
          ) : null}
          {current.manages ? (
            <ListRow
              leading={<IconTile icon="trash.fill" color="red" />}
              title={removeFolder.isPending ? "Excluindo…" : "Excluir pasta"}
              tone="destructive"
              trailing={removeFolder.isPending ? <ActivityIndicator size="small" color={palette.muted} /> : "none"}
              onPress={removeFolder.isPending ? undefined : () => askDeleteFolder(current)}
            />
          ) : null}
        </Section>
      ) : null}
      {flash ? (
        <View style={{ marginHorizontal: space.gutter }}>
          <Notice kind="success">{flash.text}</Notice>
        </View>
      ) : null}
      {list.error ? (
        <View style={{ marginHorizontal: space.gutter }}>
          <Notice kind="error">{errorMessage(list.error)}</Notice>
        </View>
      ) : null}
      {first && items.length > 0 ? (
        <Text variant="caption" tone="muted" style={{ marginHorizontal: space.gutter + 16 }}>
          {first.total === 1 ? "1 bookmark" : `${first.total} bookmarks`}
        </Text>
      ) : null}
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: "Buscar por título ou link",
            hideWhenScrolling: false,
            autoCapitalize: "none",
            onChangeText: (e) => setSearch(e.nativeEvent.text),
          },
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              <HeaderIconButton symbol="folder.badge.plus" label="Nova pasta" testID="new-folder" onPress={newFolder} />
              <HeaderIconButton symbol="plus" label="Adicionar bookmark" testID="new-bookmark" onPress={add} />
            </View>
          ),
        }}
      />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: space.sm, paddingBottom: bottom }}
        scrollIndicatorInsets={{ bottom }}
        refreshControl={<RefreshControl refreshing={list.isRefetching && !list.isFetchingNextPage} onRefresh={() => void list.refetch()} />}
        onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && void list.fetchNextPage()}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={header}
        ListEmptyComponent={
          list.isPending ? (
            loading ? <SkeletonRows /> : undefined
          ) : list.error ? undefined : deferred ? (
            <EmptyState icon="magnifyingglass" title="Nenhum bookmark encontrado" text="Tente outro termo ou mude os filtros." />
          ) : (
            <EmptyState
              icon="bookmark"
              title="Nenhum bookmark aqui"
              text="Guarde links e arquivos pequenos da empresa e organize em pastas."
              action={{ label: "Adicionar", icon: "plus", onPress: add }}
            />
          )
        }
        ListFooterComponent={
          list.isFetchingNextPage ? <ActivityIndicator accessibilityLabel="Carregando mais" style={{ paddingVertical: space.lg }} /> : undefined
        }
        ItemSeparatorComponent={GroupSeparator}
        renderItem={({ item, index }) => {
          const where = shown === "all" && item.folderId ? names.get(item.folderId) : null;
          const whose = manyCompanies && company === "all" && !current && item.companyId ? companyName.get(item.companyId) : null;
          const detail = [where, describe(item), whose].filter(Boolean).join(" · ");
          const added = `Adicionado em ${when(item.createdAt)}`;
          return (
            <View style={[groupedItem(palette, index, items.length), { opacity: list.isPlaceholderData ? 0.6 : 1 }]}>
              <ListRow
                leading={<BookmarkIcon item={item} />}
                title={item.title}
                subtitle={
                  detail ? (
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {detail}
                    </Text>
                  ) : undefined
                }
                meta={added}
                trailing={
                  item.editable ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Ações de ${item.title}`}
                      hitSlop={10}
                      onPress={() => actions(item)}
                      style={{ padding: 4 }}
                    >
                      <SymbolView name="ellipsis.circle" size={20} tintColor={palette.muted} accessible={false} />
                    </Pressable>
                  ) : item.kind === "link" ? (
                    "external"
                  ) : (
                    "chevron"
                  )
                }
                accessibilityLabel={[item.title, kindLabels[item.kind], detail, added].filter(Boolean).join(", ")}
                accessibilityActions={
                  item.editable
                    ? [
                        { name: "edit", label: "Editar" },
                        { name: "move", label: "Mover para" },
                        { name: "delete", label: "Excluir" },
                      ]
                    : undefined
                }
                onAccessibilityAction={(event) => {
                  if (event.nativeEvent.actionName === "edit") edit(item);
                  else if (event.nativeEvent.actionName === "move") move(item);
                  else if (event.nativeEvent.actionName === "delete") askDelete(item);
                }}
                onLongPress={item.editable ? () => actions(item) : undefined}
                onPress={() => void openBookmark(item)}
              />
            </View>
          );
        }}
      />
    </>
  );
}
