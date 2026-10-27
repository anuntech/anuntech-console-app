import { ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Check } from "@/components/bookmark-pickers";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { api, errorMessage } from "@/lib/api";
import { folderTree } from "@/lib/bookmark-text";
import { refreshBookmarks, useBookmarkChoices } from "@/lib/bookmarks";
import { showFlash } from "@/lib/flash";
import { haptic } from "@/lib/haptics";
import { space } from "@/lib/theme";

/** "Mover pasta": to the top or inside another folder of the same company, never into itself or below it. */
export default function MoveFolder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const choices = useBookmarkChoices();
  const loading = useDelayed(choices.isPending);
  const folders = choices.data?.folders ?? [];
  const folder = folders.find((f) => f.id === id);
  const move = useMutation({
    mutationFn: (parentId: string) => api.bookmarks.moveFolder({ id: id ?? "", parentId }),
    onSuccess: async ({ message }) => {
      haptic.success();
      showFlash(message);
      await refreshBookmarks();
      router.back();
    },
    onError: () => haptic.error(),
  });
  // Itself and everything below it are not places to go.
  const below = new Set<string>([id ?? ""]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const f of folders)
      if (f.parentId && below.has(f.parentId) && !below.has(f.id)) {
        below.add(f.id);
        grew = true;
      }
  }
  const places = folderTree(folders.filter((f) => f.companyId === folder?.companyId && !below.has(f.id)));
  const pick = (parentId: string) => {
    if (move.isPending || parentId === (folder?.parentId ?? "")) return;
    haptic.select();
    move.mutate(parentId);
  };
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingTop: space.sm, gap: space.block, paddingBottom: space.xxl }}>
      <Text variant="subhead" tone="muted" style={{ marginHorizontal: space.gutter + 4 }} numberOfLines={2}>
        {folder ? `“${folder.name}” vai com tudo o que tem dentro.` : ""}
      </Text>
      {loading ? <SkeletonRows count={3} /> : null}
      {folder ? (
        <Section header="Para" inset={space.gutter}>
          <ListRow title="Início (fora de outras pastas)" trailing={!folder.parentId ? <Check /> : "none"} onPress={() => pick("")} />
          {places.map((f) => (
            <ListRow
              key={f.id}
              title={`${"— ".repeat(f.depth)}${f.name}`}
              trailing={folder.parentId === f.id ? <Check /> : "none"}
              onPress={() => pick(f.id)}
            />
          ))}
        </Section>
      ) : null}
      {move.error || choices.error ? (
        <View style={{ paddingHorizontal: space.gutter }}>
          <Notice kind="error">{errorMessage(move.error ?? choices.error)}</Notice>
        </View>
      ) : null}
    </ScrollView>
  );
}
