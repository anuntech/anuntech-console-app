import { ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { BookmarkGate } from "@/components/bookmark-gate";
import { FolderPicker } from "@/components/bookmark-pickers";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { api, errorMessage } from "@/lib/api";
import { refreshBookmarks, useBookmarkChoices, type Bookmark } from "@/lib/bookmarks";
import { showFlash } from "@/lib/flash";
import { haptic } from "@/lib/haptics";
import { space } from "@/lib/theme";

/** "Mover para" (Sem pasta or another folder of the same company) or, with `modo=copiar`, "Copiar para" (any folder the person can add to). */
export default function MoveBookmark() {
  const { id, modo } = useLocalSearchParams<{ id: string; modo?: string }>();
  return <BookmarkGate id={id ?? ""}>{(item) => <Mover item={item} copy={modo === "copiar"} />}</BookmarkGate>;
}

function Mover({ item, copy }: { item: Bookmark; copy: boolean }) {
  const choices = useBookmarkChoices();
  const loading = useDelayed(choices.isPending);
  const move = useMutation({
    mutationFn: (folderId: string) => (copy ? api.bookmarks.copy({ id: item.id, folderId }) : api.bookmarks.move({ id: item.id, folderId })),
    onSuccess: async ({ message }) => {
      haptic.success();
      showFlash(message);
      await refreshBookmarks();
      router.back();
    },
    onError: () => haptic.error(),
  });
  // A copy may go to another company of the person; a move stays in the item's own, as on the web's menu.
  const folders = (choices.data?.folders ?? []).filter((f) => copy || f.companyId === item.companyId);
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
          header={copy ? "Copiar para" : "Mover para"}
          folders={folders}
          showCompany={copy && new Set(folders.map((f) => f.companyId)).size > 1}
          value={copy ? "-" : (item.folderId ?? "")}
          onChange={(folderId) => {
            if (move.isPending || (!copy && folderId === (item.folderId ?? ""))) return;
            move.mutate(folderId);
          }}
        />
      ) : null}
      {move.isPending ? (
        <Text variant="caption" tone="muted" style={{ marginHorizontal: space.gutter + 4 }}>
          {copy ? "Copiando…" : "Movendo…"}
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
