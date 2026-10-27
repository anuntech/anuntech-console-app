import { useDeferredValue, useEffect, useState } from "react";
import { AccessibilityInfo, ActionSheetIOS, ActivityIndicator, Alert, FlatList, Platform, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { router, Stack } from "expo-router";
import { Image } from "expo-image";
import { SymbolView } from "@/components/symbol";
import { keepPreviousData, useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { SpaceMeter, UploadTray } from "@/components/arquivos-tray";
import { Avatar } from "@/components/avatar";
import { Chip } from "@/components/chip";
import { FileThumb } from "@/components/file-thumb";
import { EmptyState } from "@/components/empty-state";
import { ListRow } from "@/components/list-row";
import { GroupSeparator, Section, groupedItem } from "@/components/section";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { IconTile } from "@/components/tile";
import { PickSheet } from "@/components/pick-sheet";
import { api, errorMessage } from "@/lib/api";
import { enqueueUploads, pickArquivos, useUploads } from "@/lib/arquivos";
import {
  BookmarkFileError,
  COPIED_LINK,
  audience,
  bookmarksKey,
  copyItemLink,
  deleteNote,
  describe,
  letterTile,
  markStarred,
  openBookmark,
  openFileViewer,
  refreshBookmarks,
  useSessionCookie,
  type Bookmark,
  type BookmarkFolder,
} from "@/lib/bookmarks";
import { KIND_OPTIONS, SORT_OPTIONS, TAG_LABELS, childrenOf, excerptParts, folderTrail, trashNote, viewChips } from "@/lib/bookmark-text";
import { CONSOLE_URL } from "@/lib/config";
import { clearFlash, showFlash, useFlash } from "@/lib/flash";
import { when } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { useTabBarSpace } from "@/lib/layout";
import { useMe } from "@/lib/me";
import { HeaderIconButton } from "@/lib/stack";
import { rounded, space, usePalette } from "@/lib/theme";
import { documentsAvailable } from "@/lib/uploads";

const kindLabels = { link: "Link", file: "Arquivo", board: "Lousa" } as const;

/** Where a search found its words in the file, the words in bold. */
function Excerpt({ text }: { text: string }) {
  return (
    <Text variant="caption" tone="muted" numberOfLines={2} style={{ marginTop: 2 }}>
      …
      {excerptParts(text).map((part, i) =>
        part.hit ? (
          <Text key={i} variant="caption" tone="foreground" style={{ fontWeight: "600" }}>
            {part.text}
          </Text>
        ) : (
          part.text
        ),
      )}
      …
    </Text>
  );
}
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
  // A file shows its picture, or the icon of its kind (the web's list tile).
  if (item.kind === "file") return <FileThumb item={item} />;
  const board = item.kind === "board";
  return (
    <View accessible={false} style={{ ...box, backgroundColor: board ? palette.accent : palette.secondary }}>
      <SymbolView
        name={board ? "scribble.variable" : "link"}
        size={15}
        tintColor={board ? palette.primary : palette.muted}
        accessible={false}
      />
    </View>
  );
}

/** A board's drawing, 16:9 under its row, as the web's grid shows it; nothing when it fails to load. */
function BoardThumb({ item, cookie }: { item: Bookmark; cookie: string }) {
  const palette = usePalette();
  const [failed, setFailed] = useState(false);
  if (failed || !item.filePath) return null;
  return (
    <View
      accessible={false}
      style={{
        marginTop: space.sm,
        width: "100%",
        maxWidth: 320,
        aspectRatio: 16 / 9,
        ...rounded(12),
        overflow: "hidden",
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: "#ffffff",
      }}
    >
      {/* filePath carries the board's version (?v=), so a new drawing is a new picture. */}
      <Image
        source={{ uri: `${CONSOLE_URL}${item.filePath}`, headers: { Cookie: cookie } }}
        style={{ flex: 1 }}
        contentFit="contain"
        cachePolicy="memory"
        accessible={false}
        onError={() => setFailed(true)}
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
 * Arquivos, as /bookmarks on the web: companies and folders as chips (with
 * "Sem pasta"), who sees the folder open, the header's search, 25 at a time,
 * and what each person may do with each file, link or board. With R2, files
 * of any size go from the phone ("Enviar arquivos", with their progress) and
 * the space each company uses shows under the list's header ("Armazenamento").
 * "Recentes" and "Com estrela" are chips beside the folders; a file opens in
 * the app's viewer, among the list's other files.
 */
export default function Bookmarks() {
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const cookie = useSessionCookie();
  const me = useMe();
  const flash = useFlash();
  useEffect(() => () => clearFlash(), []);
  const [company, setCompany] = useState("all");
  const [folder, setFolder] = useState("all");
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search.trim());
  // The web's filters: a tag, a type, the order and only what the person added.
  const [tag, setTag] = useState("");
  const [kind, setKind] = useState("");
  const [sort, setSort] = useState("");
  const [mine, setMine] = useState(false);
  const [picking, setPicking] = useState<"kind" | "sort" | null>(null);
  const list = useInfiniteQuery({
    queryKey: [...bookmarksKey, company, folder, deferred, tag, kind, sort, mine],
    queryFn: ({ pageParam }) => api.bookmarks.list({ company, folder, search: deferred, page: pageParam, tag, kind, sort, mine }),
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
  const inTrash = shown === "lixeira";
  // The rail's own views: what the person starred, and what they touched in 30 days.
  const inView = shown === "estrela" || shown === "recentes";
  const trail = current ? folderTrail(folders, current.id) : [];
  const parent = trail.length > 1 ? trail[trail.length - 2] : null;
  // Inside a folder, its subfolders; elsewhere, the folders at the top.
  const levelFolders = current ? childrenOf(folders, current.id) : childrenOf(folders, null);
  // "Só ver e baixar": only its owner and the team add to it.
  const canAdd = !current || current.adds !== "owner" || current.manages;
  const go = (next: string) => {
    setFolder(next);
    setTag("");
  };
  const names = new Map(folders.map((f) => [f.id, f.name]));
  const manyCompanies = companies.length > 1;
  const companyName = new Map(companies.map((c) => [c.id, c.name]));
  const uploads = useUploads();
  const largeFiles = !!first?.largeFiles;
  const spaces = first?.spaces ?? [];

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
  /** Several files at once into the folder (or company) open, as the web's "Enviar arquivos". */
  const upload = () => {
    clearFlash();
    const target = current
      ? { companyId: current.companyId ?? "", folderId: current.id }
      : company !== "all"
        ? { companyId: company, folderId: "" }
        : companies.length === 1
          ? { companyId: companies[0].id, folderId: "" }
          : null;
    // Several companies and none chosen: the form asks where.
    if (!target?.companyId) return router.push({ pathname: "/bookmarks/novo", params: { kind: "file" } });
    const send = async (source: "files" | "library" | "camera") => {
      try {
        const files = await pickArquivos(source);
        if (!files.length) return;
        haptic.select();
        enqueueUploads(files, target);
      } catch (failure) {
        haptic.error();
        Alert.alert("Não foi possível enviar", failure instanceof BookmarkFileError ? failure.message : "Tente novamente.");
      }
    };
    const where = current ? `Em “${current.name}”.` : manyCompanies ? `Em ${companyName.get(target.companyId) ?? "sua empresa"}.` : undefined;
    if (Platform.OS === "ios") {
      const options = documentsAvailable ? ["Arquivos", "Fotos e vídeos", "Tirar foto", "Cancelar"] : ["Fotos e vídeos", "Tirar foto", "Cancelar"];
      const sources = (documentsAvailable ? ["files", "library", "camera"] : ["library", "camera"]) as ("files" | "library" | "camera")[];
      ActionSheetIOS.showActionSheetWithOptions({ title: "Enviar arquivos", message: where, options, cancelButtonIndex: options.length - 1 }, (index) => {
        if (sources[index]) void send(sources[index]);
      });
      return;
    }
    Alert.alert(
      "Enviar arquivos",
      where,
      [
        ...(documentsAvailable ? [{ text: "Arquivos", onPress: () => void send("files") }] : []),
        { text: "Fotos e vídeos", onPress: () => void send("library") },
        { text: "Tirar foto", onPress: () => void send("camera") },
      ],
      { cancelable: true },
    );
  };
  const newFolder = () => {
    clearFlash();
    // Inside the open folder, as the web's "Nova pasta" there.
    router.push({ pathname: "/bookmarks/pasta", params: current ? { parentId: current.id } : { companyId: company !== "all" ? company : "" } });
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
  const restoreBookmark = useMutation({ mutationFn: (id: string) => api.bookmarks.restore({ id }), onSuccess: done, onError: failed });
  const purgeBookmark = useMutation({ mutationFn: (id: string) => api.bookmarks.purge({ id }), onSuccess: done, onError: failed });
  // The star turns at once; the lists come again for "Com estrela" and its count.
  const star = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => api.bookmarks.star({ id, starred: on }),
    onMutate: ({ id, on }) => {
      haptic.select();
      markStarred(id, on);
    },
    onSuccess: ({ starred }, { id }) => {
      markStarred(id, starred);
      void refreshBookmarks();
    },
    onError: (error, { id, on }) => {
      markStarred(id, !on);
      failed(error);
    },
  });
  const toggleStar = (item: Bookmark) => star.mutate({ id: item.id, on: !item.starred });
  /** "Copiar link": the item's address in the Console, which opens only for who already sees it. */
  const copyLink = async (item: Bookmark) => {
    try {
      await copyItemLink(item.id);
      haptic.success();
      showFlash(COPIED_LINK);
      AccessibilityInfo.announceForAccessibility(COPIED_LINK);
    } catch {
      haptic.error();
      Alert.alert("Não foi possível copiar.");
    }
  };
  /** A file opens in the viewer, among the list's files; a link in the browser, a board full screen. */
  const open = (item: Bookmark) => (item.kind === "file" ? openFileViewer(item, items) : void openBookmark(item));
  const removeFolder = useMutation({
    mutationFn: (id: string) => api.bookmarks.deleteFolder({ id }),
    onSuccess: (answer) => {
      go(parent?.id ?? "all");
      done(answer);
    },
    onError: failed,
  });

  const askDelete = (item: Bookmark) => {
    haptic.medium();
    Alert.alert("Mover para a lixeira?", `"${item.title}" vai para a lixeira${deleteNote(item)} e fica lá por 30 dias. Dá para restaurar.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Mover para a lixeira", style: "destructive", onPress: () => removeBookmark.mutate(item.id) },
    ]);
  };
  const askPurge = (item: Bookmark) => {
    haptic.medium();
    Alert.alert("Excluir de vez?", `"${item.title}" sai para sempre${deleteNote(item)}. Isso não tem volta.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir de vez", style: "destructive", onPress: () => purgeBookmark.mutate(item.id) },
    ]);
  };
  /** In the trash: restore, or delete for good (who saved it, the folder's owner, the team). */
  const trashActions = (item: Bookmark) => {
    if (!item.editable) return Alert.alert(item.title, "Só quem adicionou ou o dono da pasta restaura este item.");
    Alert.alert(item.title, item.deletedAt ? `Na lixeira: ${trashNote(item.deletedAt)}.` : undefined, [
      { text: "Excluir de vez", style: "destructive", onPress: () => askPurge(item) },
      { text: "Restaurar", onPress: () => restoreBookmark.mutate(item.id) },
    ]);
  };
  const askDeleteFolder = (f: BookmarkFolder) => {
    haptic.medium();
    Alert.alert(`Excluir “${f.name}”?`, "O que está dentro não é apagado: sobe para a pasta de cima (ou para “Sem pasta”).", [
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
  const copy = (item: Bookmark) => {
    clearFlash();
    router.push({ pathname: "/bookmarks/[id]/mover", params: { id: item.id, modo: "copiar" } });
  };
  const shareByLink = (params: { bookmarkId?: string; folderId?: string; kind?: "request"; title: string }) => {
    clearFlash();
    router.push({ pathname: "/bookmarks/links", params });
  };
  const rename = (item: Bookmark) => {
    clearFlash();
    router.push({ pathname: "/bookmarks/[id]/renomear", params: { id: item.id } });
  };
  const [menu, setMenu] = useState<Bookmark | null>(null);

  /**
   * The web's "…" menu: open (and a file's details), the star and "Copiar
   * link" for everyone; for who saved it or the folder's owner, rename, edit,
   * move, copy, share and delete.
   */
  const stepsOf = (item: Bookmark): [string, () => void][] => [
    [openLabels[item.kind], () => void openBookmark(item)],
    ...(item.kind === "file" ? ([["Detalhes", () => openFileViewer(item, items)]] as [string, () => void][]) : []),
    [item.starred ? "Tirar a estrela" : "Marcar com estrela", () => toggleStar(item)],
    ["Copiar link", () => void copyLink(item)],
    ...(item.editable
      ? ([
          ["Renomear", () => rename(item)],
          ["Editar", () => edit(item)],
          ["Mover para", () => move(item)],
          ["Copiar para…", () => copy(item)],
          ...(item.kind === "file" ? ([["Compartilhar por link", () => shareByLink({ bookmarkId: item.id, title: item.title })]] as [string, () => void][]) : []),
          ["Mover para a lixeira", () => askDelete(item)],
        ] as [string, () => void][])
      : []),
  ];
  const actions = (item: Bookmark) => {
    if (Platform.OS === "ios") {
      const steps = stepsOf(item);
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: item.title,
          options: [...steps.map(([label]) => label), "Cancelar"],
          cancelButtonIndex: steps.length,
          destructiveButtonIndex: item.editable ? steps.length - 1 : undefined,
        },
        (index) => steps[index]?.[1](),
      );
      return;
    }
    // Android's dialog holds three buttons: the same steps in a sheet.
    setMenu(item);
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
          {current ? (
            // Inside a folder: back up one level, then its subfolders.
            <Chip label={`‹ ${parent?.name ?? "Todos"}`} group="Pastas" selected={false} onPress={() => go(parent?.id ?? "all")} />
          ) : (
            <>
              <Chip label="Todos" group="Pastas" selected={shown === "all"} onPress={() => go("all")} />
              {viewChips(first.starredCount).map((view) => (
                <Chip key={view.value} label={view.label} group="Pastas" selected={shown === view.value} onPress={() => go(view.value)} />
              ))}
              <Chip label={`Sem pasta · ${first.rootCount}`} group="Pastas" selected={shown === "root"} onPress={() => go("root")} />
            </>
          )}
          {levelFolders.map((f) => (
            <Chip
              key={f.id}
              label={`${f.name}${manyCompanies && company === "all" && f.company ? ` (${f.company})` : ""} · ${f.count}`}
              group={f.visibility === "people" ? "Pastas, compartilhada com pessoas escolhidas" : "Pastas"}
              selected={shown === f.id}
              onPress={() => go(f.id)}
            />
          ))}
          {!current ? (
            <Chip label={`Lixeira${first.trashCount ? ` · ${first.trashCount}` : ""}`} group="Pastas" selected={inTrash} onPress={() => go("lixeira")} />
          ) : null}
        </ScrollView>
      ) : null}
      {first && !inTrash ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.gutter, paddingVertical: 4 }}
        >
          <Chip label={KIND_OPTIONS.find((o) => o.value === kind)?.label ?? "Todos os tipos"} group="Filtros" selected={!!kind} onPress={() => setPicking("kind")} />
          <Chip label={SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Mais recentes"} group="Ordem" selected={!!sort} onPress={() => setPicking("sort")} />
          <Chip label="Só os meus" group="Filtros" selected={mine} onPress={() => setMine((on) => !on)} />
          {(first.tags ?? []).map((t) => (
            <Chip key={t.tag} label={`${TAG_LABELS[t.tag] ?? t.tag} · ${t.count}`} group="Etiquetas" selected={tag === t.tag} onPress={() => setTag(tag === t.tag ? "" : t.tag)} />
          ))}
        </ScrollView>
      ) : null}
      {trail.length > 1 ? (
        <Text variant="caption" tone="muted" numberOfLines={1} style={{ marginHorizontal: space.gutter + 4 }}>
          {trail.map((f) => f.name).join(" › ")}
        </Text>
      ) : null}
      {inTrash ? (
        <View style={{ marginHorizontal: space.gutter }}>
          <Notice kind="info">O que você exclui fica aqui por 30 dias. Toque num item para restaurar ou excluir de vez.</Notice>
        </View>
      ) : null}
      {current ? (
        <Section inset={space.gutter} indent={60}>
          <ListRow
            leading={<IconTile icon={current.visibility === "people" ? "person.2.fill" : "building.2.fill"} color={current.visibility === "people" ? "violet" : "teal"} />}
            title="Quem vê"
            subtitle={[
              audience(current, me.data?.id),
              current.adds === "owner" ? "só ver e baixar" : null,
              current.system ? "mantida pelo Console" : null,
              manyCompanies ? current.company : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            trailing={
              current.manages && !current.system ? (
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
            accessibilityHint={current.manages && !current.system ? "Compartilhar a pasta" : undefined}
            onPress={
              current.manages && !current.system
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
          {current.manages && largeFiles ? (
            <ListRow
              leading={<IconTile icon="link" color="ink" />}
              title="Compartilhar por link"
              onPress={() => shareByLink({ folderId: current.id, title: current.name })}
            />
          ) : null}
          {current.manages && largeFiles ? (
            <ListRow
              leading={<IconTile icon="tray.and.arrow.down.fill" color="teal" />}
              title="Pedir arquivos"
              onPress={() => shareByLink({ folderId: current.id, kind: "request", title: current.name })}
            />
          ) : null}
          {current.manages && !current.system ? (
            <ListRow
              leading={<IconTile icon="folder" color="gray" />}
              title="Mover pasta"
              onPress={() => {
                clearFlash();
                router.push({ pathname: "/bookmarks/mover-pasta", params: { id: current.id } });
              }}
            />
          ) : null}
          {current.manages && !current.system ? (
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
      <UploadTray items={uploads} />
      {spaces.length ? (
        <SpaceMeter spaces={spaces} nameOf={(id) => (id ? (companyName.get(id) ?? "Empresa") : "Anuntech")} />
      ) : null}
      {first && items.length > 0 ? (
        <Text variant="caption" tone="muted" style={{ marginHorizontal: space.gutter + 16 }}>
          {first.total === 1 ? "1 item" : `${first.total} itens`}
        </Text>
      ) : null}
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: "Buscar pelo nome ou pelo conteúdo",
            hideWhenScrolling: false,
            autoCapitalize: "none",
            onChangeText: (e) => setSearch(e.nativeEvent.text),
          },
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              {largeFiles && canAdd && !inTrash ? <HeaderIconButton symbol="icloud.and.arrow.up" label="Enviar arquivos" testID="upload-files" onPress={upload} /> : null}
              {canAdd && !inTrash ? <HeaderIconButton symbol="folder.badge.plus" label={current ? "Nova pasta aqui" : "Nova pasta"} testID="new-folder" onPress={newFolder} /> : null}
              {canAdd && !inTrash ? <HeaderIconButton symbol="plus" label="Adicionar" testID="new-bookmark" onPress={add} /> : null}
            </View>
          ),
        }}
      />
      <PickSheet
        visible={picking === "kind"}
        onClose={() => setPicking(null)}
        title="Tipo"
        options={KIND_OPTIONS}
        selected={[kind]}
        onChange={([value]) => setKind(value ?? "")}
      />
      <PickSheet
        visible={picking === "sort"}
        onClose={() => setPicking(null)}
        title="Ordem"
        options={SORT_OPTIONS}
        selected={[sort]}
        onChange={([value]) => setSort(value ?? "")}
      />
      <PickSheet
        visible={!!menu}
        onClose={() => setMenu(null)}
        title={menu?.title ?? ""}
        options={menu ? stepsOf(menu).map(([label]) => ({ value: label, label })) : []}
        selected={[]}
        onChange={([label]) => {
          const step = menu ? stepsOf(menu).find(([name]) => name === label) : undefined;
          setMenu(null);
          step?.[1]();
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
            <EmptyState icon="magnifyingglass" title="Nada encontrado" text="Tente outra palavra (a busca também procura dentro dos arquivos) ou mude os filtros." />
          ) : inTrash ? (
            <EmptyState icon="trash" title="A lixeira está vazia" text="O que você excluir fica aqui por 30 dias." />
          ) : shown === "estrela" ? (
            <EmptyState icon="star" title="Nada aqui ainda" text="Marque com estrela o que você usa sempre: fica aqui, só para você." />
          ) : shown === "recentes" ? (
            <EmptyState icon="clock" title="Nada aqui ainda" text="O que você adicionar, alterar ou abrir nos últimos 30 dias aparece aqui." />
          ) : (
            <EmptyState
              icon="folder"
              title="Nada aqui ainda"
              text={
                largeFiles
                  ? "Guarde arquivos de até 100 GB, links e lousas da empresa e organize em pastas."
                  : "Guarde arquivos, links e lousas da empresa e organize em pastas."
              }
              action={canAdd ? { label: "Adicionar", icon: "plus", onPress: add } : undefined}
            />
          )
        }
        ListFooterComponent={
          list.isFetchingNextPage ? <ActivityIndicator accessibilityLabel="Carregando mais" style={{ paddingVertical: space.lg }} /> : undefined
        }
        ItemSeparatorComponent={GroupSeparator}
        renderItem={({ item, index }) => {
          // Where it sits, when the list spans folders (everything, the stars, the recent ones).
          const where = (shown === "all" || inView) && item.folderId ? names.get(item.folderId) : null;
          const whose = manyCompanies && company === "all" && !current && item.companyId ? companyName.get(item.companyId) : null;
          const detail = [item.tag ? TAG_LABELS[item.tag] : null, where, describe(item), whose, item.deletedAt ? trashNote(item.deletedAt) : null].filter(Boolean).join(" · ");
          const added = `Adicionado em ${when(item.createdAt)}`;
          const thumb = item.kind === "board" && item.hasPreview;
          return (
            <View style={[groupedItem(palette, index, items.length), { opacity: list.isPlaceholderData ? 0.6 : 1 }]}>
              <ListRow
                leading={<BookmarkIcon item={item} />}
                title={item.title}
                subtitle={
                  detail || thumb || item.excerpt ? (
                    <View>
                      {detail ? (
                        <Text variant="caption" tone="muted" numberOfLines={1}>
                          {detail}
                        </Text>
                      ) : null}
                      {item.excerpt ? <Excerpt text={item.excerpt} /> : null}
                      {thumb && cookie ? <BoardThumb item={item} cookie={cookie} /> : null}
                    </View>
                  ) : undefined
                }
                meta={added}
                trailing={
                  !inTrash ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                      {item.starred ? <SymbolView name="star.fill" size={13} tintColor={palette.primary} accessible={false} /> : null}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Ações de ${item.title}`}
                        hitSlop={10}
                        onPress={() => actions(item)}
                        style={{ padding: 4 }}
                      >
                        <SymbolView name="ellipsis.circle" size={20} tintColor={palette.muted} accessible={false} />
                      </Pressable>
                    </View>
                  ) : (
                    "chevron"
                  )
                }
                accessibilityLabel={[item.title, kindLabels[item.kind], item.starred ? "com estrela" : null, detail, added].filter(Boolean).join(", ")}
                accessibilityActions={
                  !inTrash
                    ? [
                        { name: "star", label: item.starred ? "Tirar a estrela" : "Marcar com estrela" },
                        { name: "link", label: "Copiar link" },
                        ...(item.editable
                          ? [
                              { name: "rename", label: "Renomear" },
                              { name: "edit", label: "Editar" },
                              { name: "move", label: "Mover para" },
                              { name: "delete", label: "Excluir" },
                            ]
                          : []),
                      ]
                    : undefined
                }
                onAccessibilityAction={(event) => {
                  const name = event.nativeEvent.actionName;
                  if (name === "star") toggleStar(item);
                  else if (name === "link") void copyLink(item);
                  else if (name === "rename") rename(item);
                  else if (name === "edit") edit(item);
                  else if (name === "move") move(item);
                  else if (name === "delete") askDelete(item);
                }}
                onLongPress={inTrash ? () => trashActions(item) : () => actions(item)}
                onPress={() => (inTrash ? trashActions(item) : open(item))}
              />
            </View>
          );
        }}
      />
    </>
  );
}
