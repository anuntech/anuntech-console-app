import { useDeferredValue, useState } from "react";
import { ActivityIndicator, Alert, FlatList, RefreshControl, ScrollView, TextInput, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Chip } from "@/components/chip";
import { Notice, Row } from "@/components/surface";
import { Text } from "@/components/text";
import { api, errorMessage } from "@/lib/api";
import { openAttachment } from "@/lib/files";
import { useTabBarSpace } from "@/lib/layout";
import { radius, space, usePalette } from "@/lib/theme";

type Item = Awaited<ReturnType<typeof api.bookmarks.list>>["items"][number];

const kindLabels = { link: "Link", file: "Arquivo", board: "Lousa" } as const;

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

/** The person's bookmarks: folders as chips, a search, and each link, file or board (bookmarks.list). */
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
  const folders = list.data?.folders ?? [];
  const names = new Map(folders.map((f) => [f.id, f.name]));
  return (
    <FlatList
      data={list.data?.items ?? []}
      keyExtractor={(item) => item.id}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      contentContainerStyle={{ padding: space.lg, gap: space.xs, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
      refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
      ListHeaderComponent={
        <View style={{ gap: space.md, marginBottom: space.sm }}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar nos bookmarks"
            accessibilityLabel="Buscar nos bookmarks"
            placeholderTextColor={palette.muted}
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={{
              minHeight: 44,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: palette.fieldBorder,
              backgroundColor: palette.field,
              paddingHorizontal: space.md,
              color: palette.foreground,
              fontSize: 16,
              // iOS recycles native inputs: the code field's spacing would carry over.
              letterSpacing: 0,
              textAlign: "left",
            }}
          />
          {folders.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              <Chip label="Todos" selected={folder === "all"} onPress={() => setFolder("all")} />
              {folders.map((f) => (
                <Chip key={f.id} label={`${f.name} · ${f.count}`} selected={folder === f.id} onPress={() => setFolder(f.id)} />
              ))}
            </ScrollView>
          ) : null}
          {list.error ? <Notice kind="error">{errorMessage(list.error)}</Notice> : null}
        </View>
      }
      ListEmptyComponent={
        list.isPending ? (
          <ActivityIndicator accessibilityLabel="Carregando" />
        ) : !list.error ? (
          <Text tone="muted" style={{ textAlign: "center", marginTop: space.block }}>
            {deferred ? "Nada encontrado com essa busca." : "Nenhum bookmark por aqui."}
          </Text>
        ) : undefined
      }
      renderItem={({ item }) => (
        <Row
          title={item.title}
          detail={[
            kindLabels[item.kind],
            folder === "all" && item.folderId ? names.get(item.folderId) : null,
            item.kind === "link" && item.url ? item.url.replace(/^https?:\/\//, "") : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          onPress={() => void open(item)}
        />
      )}
    />
  );
}
