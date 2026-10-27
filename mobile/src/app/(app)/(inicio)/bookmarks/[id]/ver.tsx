import { useEffect, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import type * as ExpoVideo from "expo-video";
import { GestureDetector, GestureHandlerRootView, usePanGesture } from "react-native-gesture-handler";
import { ORPCError } from "@orpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { GROUP_SYMBOLS, thumbCacheKey } from "@/components/file-thumb";
import { ListRow } from "@/components/list-row";
import { LoadError } from "@/components/manager-gate";
import { Section } from "@/components/section";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { SymbolView, type SFSymbol } from "@/components/symbol";
import { Text } from "@/components/text";
import { IconTile } from "@/components/tile";
import { api, errorMessage } from "@/lib/api";
import { fileDetails, fileTypeOf, neighbours, showsPage } from "@/lib/bookmark-text";
import {
  COPIED_LINK,
  cachedBookmark,
  copyItemLink,
  filesForViewer,
  markStarred,
  openBookmark,
  refreshBookmarks,
  useBookmarkChoices,
  useSessionCookie,
  type Bookmark,
} from "@/lib/bookmarks";
import { CONSOLE_URL } from "@/lib/config";
import { fileSize } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { useTabBarSpace } from "@/lib/layout";
import { HeaderIconButton } from "@/lib/stack";
import { rounded, space, usePalette } from "@/lib/theme";
import { opensOutside } from "@/lib/upload-plan";

/*
 * The player is a native module that builds before 1.2.0 do not have: an
 * update over the air must not crash them, so there a video opens as any file.
 */
const video: typeof ExpoVideo | null = requireOptionalNativeModule("ExpoVideo")
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("expo-video") as typeof ExpoVideo)
  : null;

/** The whole of the preview box. */
const FILL = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const;

/** How far a swipe goes before it moves to the next file. */
const SWIPE = 60;

const openLabels = { link: "Abrir link", file: "Baixar", board: "Abrir lousa" } as const;

/**
 * A file in the app, as the web's viewer (FilePreview): the photo, the
 * video or the top of the document when the Console has it, or the kind,
 * big; its details below; the arrows (or a swipe) to the list's other files;
 * the star, "Copiar link", "Renomear" and "Editar". "Baixar" opens it on the
 * phone (a photo in the full-screen viewer, with zoom; anything else in the
 * share sheet, which previews PDFs). Opened from Arquivos, Início or a link
 * with ?abrir=.
 */
export default function FileViewer() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({
    queryKey: ["bookmark", id],
    queryFn: () => api.bookmarks.get({ id }),
    // What the list already showed opens at once.
    initialData: () => cachedBookmark(id) ?? undefined,
    staleTime: 60_000,
    enabled: !!id,
  });
  const loading = useDelayed(query.isPending);
  const item = query.data;
  if (item) return <Viewer key={item.id} item={item} refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />;
  const gone = !id || (query.error instanceof ORPCError && query.error.status === 404);
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingTop: space.sm }}>
      <Stack.Screen options={{ title: "" }} />
      {gone ? (
        <EmptyState
          icon="bookmark.slash"
          title="Item não encontrado"
          text="Ele pode ter sido excluído ou você não tem acesso a ele."
          action={
            router.canGoBack()
              ? { label: "Voltar", onPress: () => router.back() }
              : { label: "Ver arquivos", onPress: () => router.replace("/bookmarks") }
          }
        />
      ) : query.error ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : loading ? (
        <SkeletonRows count={4} />
      ) : null}
    </ScrollView>
  );
}

function RoundButton({ symbol, label, onPress }: { symbol: SFSymbol; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.45)",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <SymbolView name={symbol} size={15} weight="semibold" tintColor="#ffffff" accessible={false} />
    </Pressable>
  );
}

function Viewer({ item, refreshing, onRefresh }: { item: Bookmark; refreshing: boolean; onRefresh: () => void }) {
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const choices = useBookmarkChoices();
  const files = filesForViewer();
  const place = neighbours(files.includes(item.id) ? files : [item.id], item.id);
  const go = (to: string | null) => {
    if (!to) return;
    haptic.select();
    router.setParams({ id: to });
  };
  const swipe = usePanGesture({
    runOnJS: true,
    activeOffsetX: [-24, 24],
    failOffsetY: [-16, 16],
    onDeactivate: (event) => {
      // Left brings the next file, right the one before, as in Fotos.
      if (event.translationX < -SWIPE) go(place.next);
      else if (event.translationX > SWIPE) go(place.previous);
    },
  });

  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);
  const copyLink = async () => {
    try {
      await copyItemLink(item.id);
      haptic.success();
      setCopied(true);
      AccessibilityInfo.announceForAccessibility(COPIED_LINK);
    } catch {
      haptic.error();
      Alert.alert("Não foi possível copiar.");
    }
  };
  const star = useMutation({
    mutationFn: (on: boolean) => api.bookmarks.star({ id: item.id, starred: on }),
    onMutate: (on) => {
      haptic.select();
      markStarred(item.id, on);
    },
    onSuccess: ({ starred }) => {
      markStarred(item.id, starred);
      void refreshBookmarks();
    },
    onError: (error, on) => {
      markStarred(item.id, !on);
      haptic.error();
      Alert.alert("Não foi possível concluir", errorMessage(error));
    },
  });
  const toggleStar = () => star.mutate(!item.starred);

  const folders = new Map((choices.data?.folders ?? []).map((f) => [f.id, f.name]));
  const companies = new Map((choices.data?.companies ?? []).map((c) => [c.id, c.name]));
  const details = item.kind === "file" ? fileDetails(item, (f) => folders.get(f), (c) => companies.get(c)) : [];
  const caption = [item.kind === "file" ? item.fileName : null, item.fileSize ? fileSize(item.fileSize) : null, place.label].filter(Boolean).join(" · ");
  const largeFiles = !!choices.data?.largeFiles;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: item.title,
          headerRight: () => (
            <HeaderIconButton
              symbol={item.starred ? "star.fill" : "star"}
              tint={item.starred ? "primary" : "foreground"}
              label={item.starred ? `Tirar a estrela de ${item.title}` : `Marcar ${item.title} com estrela`}
              testID="star-file"
              onPress={toggleStar}
            />
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingTop: space.sm, gap: space.block, paddingBottom: bottom }}
        scrollIndicatorInsets={{ bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={{ marginHorizontal: space.gutter, gap: space.sm }}>
          <GestureDetector gesture={swipe}>
            <View
              style={{
                aspectRatio: 4 / 3,
                ...rounded(20),
                overflow: "hidden",
                backgroundColor: palette.secondary,
                borderWidth: palette.dark ? 1 : 0,
                borderColor: palette.border,
              }}
            >
              <Preview item={item} />
              {place.previous ? (
                <View style={{ position: "absolute", left: space.sm, top: 0, bottom: 0, justifyContent: "center" }}>
                  <RoundButton symbol="chevron.left" label="Arquivo anterior" onPress={() => go(place.previous)} />
                </View>
              ) : null}
              {place.next ? (
                <View style={{ position: "absolute", right: space.sm, top: 0, bottom: 0, justifyContent: "center" }}>
                  <RoundButton symbol="chevron.right" label="Próximo arquivo" onPress={() => go(place.next)} />
                </View>
              ) : null}
            </View>
          </GestureDetector>
          {caption ? (
            <Text variant="caption" tone="muted" numberOfLines={1} style={{ textAlign: "center", fontVariant: ["tabular-nums"] }}>
              {caption}
            </Text>
          ) : null}
          <Button title={openLabels[item.kind]} icon={item.kind === "file" ? "square.and.arrow.down" : "arrow.up.right"} onPress={() => void openBookmark(item)} />
        </View>
        {details.length ? (
          <Section header="Detalhes" inset={space.gutter}>
            {details.map(([term, value]) => (
              <ListRow key={term} title={term} value={value} />
            ))}
          </Section>
        ) : null}
        <Section inset={space.gutter} indent={60} footer="O link só abre para quem já tem acesso ao item.">
          <ListRow
            leading={<IconTile icon={item.starred ? "star.fill" : "star"} color="violet" />}
            title={item.starred ? "Tirar a estrela" : "Marcar com estrela"}
            accessibilityState={{ selected: !!item.starred }}
            onPress={toggleStar}
          />
          <ListRow leading={<IconTile icon="link" color="ink" />} title={copied ? "Link copiado" : "Copiar link"} onPress={() => void copyLink()} />
          {item.editable ? (
            <ListRow
              leading={<IconTile icon="textformat" color="gray" />}
              title="Renomear"
              trailing="chevron"
              onPress={() => router.push({ pathname: "/bookmarks/[id]/renomear", params: { id: item.id } })}
            />
          ) : null}
          {item.editable ? (
            <ListRow
              leading={<IconTile icon="pencil" color="gray" />}
              title="Editar"
              trailing="chevron"
              onPress={() => router.push({ pathname: "/bookmarks/[id]/editar", params: { id: item.id } })}
            />
          ) : null}
          {item.editable && item.kind === "file" && largeFiles ? (
            <ListRow
              leading={<IconTile icon="square.and.arrow.up" color="teal" />}
              title="Compartilhar por link"
              trailing="chevron"
              onPress={() => router.push({ pathname: "/bookmarks/links", params: { bookmarkId: item.id, title: item.title } })}
            />
          ) : null}
        </Section>
      </ScrollView>
    </GestureHandlerRootView>
  );
}

/** What fills the top: the photo, the video, the top of the document, or the kind, big. */
function Preview({ item }: { item: Bookmark }) {
  const palette = usePalette();
  const cookie = useSessionCookie();
  const type = fileTypeOf(item.fileName);
  const [failed, setFailed] = useState(false);
  // A photo or a video is read through a five-minute address (bookmarks.download, inline); a big one opens outside, as "Baixar" says.
  const media = item.kind === "file" && (type.group === "image" || type.group === "video") && !opensOutside(item.fileSize);
  const address = useQuery({
    queryKey: ["bookmark-inline", item.id, item.updatedAt],
    queryFn: () => api.bookmarks.download({ id: item.id, inline: true }),
    enabled: media,
    staleTime: 4 * 60_000,
    gcTime: 4 * 60_000,
  });
  const fill = FILL;
  if (item.kind === "file" && type.group === "image" && !failed && ((media && !address.isError) || item.thumbUrl)) {
    // An older file kept in the database comes through its path, with the session.
    const full = address.data?.url
      ? { uri: address.data.url, cacheKey: `arquivo-${item.id}-${item.updatedAt}` }
      : address.data && item.filePath && cookie
        ? { uri: `${CONSOLE_URL}${item.filePath}`, headers: { Cookie: cookie } }
        : null;
    const thumb = item.thumbUrl ? { uri: item.thumbUrl, cacheKey: thumbCacheKey(item) } : null;
    return (
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={item.title}
        accessibilityHint="Abre a foto em tela cheia, com zoom"
        onPress={() => void openBookmark(item)}
        style={fill}
      >
        <Image
          source={full ?? thumb}
          placeholder={full ? thumb : undefined}
          style={fill}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={150}
          accessible={false}
          onError={() => setFailed(true)}
        />
        {!full && address.isFetching ? <ActivityIndicator style={{ position: "absolute", right: space.md, bottom: space.md }} /> : null}
      </Pressable>
    );
  }
  if (item.kind === "file" && type.group === "video" && video && address.data?.url)
    return <InlineVideo module={video} uri={address.data.url} title={item.title} />;
  if (item.kind === "file" && showsPage(type.group) && item.page)
    return (
      <View accessible accessibilityLabel={`Início de ${item.title}: ${item.page}`} style={{ ...fill, paddingHorizontal: space.lg, paddingTop: space.lg }}>
        {/* The start of the text the Console read, as the top of a page (the web's card). */}
        <View style={{ flex: 1, backgroundColor: "#ffffff", borderTopLeftRadius: 8, borderTopRightRadius: 8, paddingHorizontal: space.md, paddingTop: space.md, overflow: "hidden" }}>
          <Text variant="caption" style={{ color: "#404040", fontSize: 11, lineHeight: 16 }} numberOfLines={14}>
            {item.page}
          </Text>
        </View>
      </View>
    );
  const symbol: SFSymbol = item.kind === "board" ? "scribble.variable" : item.kind === "link" ? "link" : GROUP_SYMBOLS[type.group];
  return (
    <View style={{ ...fill, alignItems: "center", justifyContent: "center", gap: space.sm, padding: space.lg }}>
      <SymbolView name={symbol} size={48} tintColor={palette.muted} accessible={false} />
      <Text variant="label" style={{ letterSpacing: 0.5 }}>
        {item.kind === "file" ? type.label : item.kind === "board" ? "LOUSA" : "LINK"}
      </Text>
      {item.kind === "file" ? (
        <Text variant="caption" tone="muted" style={{ textAlign: "center" }}>
          {media && address.isPending
            ? "Carregando…"
            : type.group === "video" && !opensOutside(item.fileSize)
              ? "Toque em Baixar para assistir."
              : "Este tipo de arquivo não tem prévia no Console. Toque em Baixar para abrir no app que você usa."}
        </Text>
      ) : null}
    </View>
  );
}

/** A video, played in place with the system's controls (full screen too). */
function InlineVideo({ module, uri, title }: { module: typeof ExpoVideo; uri: string; title: string }) {
  const player = module.useVideoPlayer(uri);
  const VideoView = module.VideoView;
  return (
    <View style={{ ...FILL, backgroundColor: "#000000" }}>
      <VideoView player={player} nativeControls fullscreenOptions={{ enable: true }} contentFit="contain" accessibilityLabel={`Vídeo: ${title}`} style={{ flex: 1 }} />
    </View>
  );
}
