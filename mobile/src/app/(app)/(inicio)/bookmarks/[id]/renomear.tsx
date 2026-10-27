import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { BookmarkGate } from "@/components/bookmark-gate";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Notice } from "@/components/surface";
import { api, errorMessage, queryClient } from "@/lib/api";
import { refreshBookmarks, type Bookmark } from "@/lib/bookmarks";
import { showFlash } from "@/lib/flash";
import { haptic } from "@/lib/haptics";
import { space } from "@/lib/theme";

/** "Renomear", as the web's dialog: only the title; the link, the folder and the file stay as they are. */
export default function RenameBookmark() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BookmarkGate id={id ?? ""}>{(item) => <Rename item={item} />}</BookmarkGate>;
}

function Rename({ item }: { item: Bookmark }) {
  const [title, setTitle] = useState(item.title);
  const [tried, setTried] = useState(false);
  const save = useMutation({
    // The same as the web's RenameDialog: bookmarks.update with the item's own link and folder, the tag untouched.
    mutationFn: () => api.bookmarks.update({ id: item.id, title: title.trim(), url: item.url ?? "", folderId: item.folderId ?? "" }),
    onSuccess: async ({ message }) => {
      haptic.success();
      showFlash(message);
      await Promise.all([refreshBookmarks(), queryClient.invalidateQueries({ queryKey: ["bookmark", item.id] })]);
      router.back();
    },
    onError: () => haptic.error(),
  });
  const submit = () => {
    setTried(true);
    if (!title.trim()) return haptic.error();
    save.mutate();
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ paddingTop: space.sm, gap: space.block, paddingBottom: space.xxl }}
      >
        <View style={{ paddingHorizontal: space.gutter, gap: space.form }}>
          <Field
            label="Nome"
            testID="rename-title"
            hint={`Só o nome muda${item.fileName ? `; o arquivo continua “${item.fileName}”` : ""}.`}
            value={title}
            onChangeText={setTitle}
            maxLength={160}
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={submit}
            invalid={tried && !title.trim()}
          />
        </View>
        <View style={{ paddingHorizontal: space.gutter, gap: space.md }}>
          {tried && !title.trim() ? <Notice kind="warning">Informe um título.</Notice> : null}
          {save.error ? <Notice kind="error">{errorMessage(save.error)}</Notice> : null}
          <Button title={save.isPending ? "Salvando…" : "Salvar"} testID="save-rename" busy={save.isPending} disabled={save.isPending} onPress={submit} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
