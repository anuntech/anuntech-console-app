import { useState } from "react";
import { ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { FolderPicker } from "@/components/bookmark-pickers";
import { EmptyState } from "@/components/empty-state";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { api, errorMessage } from "@/lib/api";
import { cachedBookmark, refreshBookmarks, useBookmarkChoices } from "@/lib/bookmarks";
import { showFlash } from "@/lib/flash";
import { haptic } from "@/lib/haptics";
import { space } from "@/lib/theme";

/** "Mover para": Sem pasta or another folder of the same company. */
export default function MoveBookmark() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item] = useState(() => cachedBookmark(id ?? ""));
  const choices = useBookmarkChoices();
  const loading = useDelayed(choices.isPending);
  const move = useMutation({
    mutationFn: (folderId: string) => api.bookmarks.move({ id: item!.id, folderId }),
    onSuccess: async ({ message }) => {
      haptic.success();
      showFlash(message);
      await refreshBookmarks();
      router.back();
    },
    onError: () => haptic.error(),
  });
  if (!item || !item.editable)
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <EmptyState
          icon="bookmark.slash"
          title="Bookmark não encontrado"
          text="Ele pode ter sido excluído ou você não pode alterá-lo. Volte para a lista."
          action={router.canGoBack() ? { label: "Voltar", onPress: () => router.back() } : undefined}
        />
      </ScrollView>
    );
  const folders = (choices.data?.folders ?? []).filter((f) => f.companyId === item.companyId);
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingTop: space.sm, gap: space.block, paddingBottom: space.xxl }}
    >
      <Text variant="subhead" tone="muted" style={{ marginHorizontal: space.gutter + 4 }} numberOfLines={2}>
        {item.title}
      </Text>
      {loading ? <SkeletonRows count={3} /> : null}
      {choices.error && !choices.data ? (
        <View style={{ paddingHorizontal: space.gutter }}>
          <Notice kind="error">{errorMessage(choices.error)}</Notice>
        </View>
      ) : null}
      {choices.data ? (
        <FolderPicker
          header="Mover para"
          folders={folders}
          value={item.folderId ?? ""}
          onChange={(folderId) => {
            if (move.isPending || folderId === (item.folderId ?? "")) return;
            move.mutate(folderId);
          }}
        />
      ) : null}
      {move.isPending ? (
        <Text variant="caption" tone="muted" style={{ marginHorizontal: space.gutter + 4 }}>
          Movendo…
        </Text>
      ) : null}
      {move.error ? (
        <View style={{ paddingHorizontal: space.gutter }}>
          <Notice kind="error">{errorMessage(move.error)}</Notice>
        </View>
      ) : null}
    </ScrollView>
  );
}
