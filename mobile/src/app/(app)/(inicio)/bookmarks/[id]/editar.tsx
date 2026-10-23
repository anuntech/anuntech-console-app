import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { BookmarkGate } from "@/components/bookmark-gate";
import { Button } from "@/components/button";
import { FolderPicker } from "@/components/bookmark-pickers";
import { Field } from "@/components/field";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { Notice } from "@/components/surface";
import { IconTile } from "@/components/tile";
import { api, errorMessage } from "@/lib/api";
import { deleteNote, openBookmark, refreshBookmarks, useBookmarkChoices, type Bookmark } from "@/lib/bookmarks";
import { showFlash } from "@/lib/flash";
import { fileSize } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { space } from "@/lib/theme";

/** "Editar bookmark": title, link and folder; a file or a drawing stays as it is. */
export default function EditBookmark() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BookmarkGate id={id ?? ""}>{(item) => <Editor item={item} />}</BookmarkGate>;
}

function Editor({ item }: { item: Bookmark }) {
  const choices = useBookmarkChoices();
  const [title, setTitle] = useState(item.title);
  const [url, setUrl] = useState(item.url ?? "");
  const [folderId, setFolder] = useState(item.folderId ?? "");
  const [tried, setTried] = useState(false);
  const folders = (choices.data?.folders ?? []).filter((f) => f.companyId === item.companyId);
  const finish = async ({ message }: { message: string }) => {
    haptic.success();
    showFlash(message);
    await refreshBookmarks();
    router.back();
  };
  const save = useMutation({
    mutationFn: () => api.bookmarks.update({ id: item.id, title: title.trim(), url: item.kind === "link" ? url.trim() : "", folderId }),
    onSuccess: finish,
    onError: () => haptic.error(),
  });
  const remove = useMutation({
    mutationFn: () => api.bookmarks.remove({ id: item.id }),
    onSuccess: finish,
    onError: () => haptic.error(),
  });
  const missing = !title.trim() ? "Informe um título." : item.kind === "link" && !url.trim() ? "Informe um link." : null;
  const submit = () => {
    setTried(true);
    if (missing) return haptic.error();
    save.mutate();
  };
  const askDelete = () => {
    haptic.medium();
    Alert.alert("Excluir bookmark?", `"${item.title}" sai da lista${deleteNote(item)}. Isso não pode ser desfeito.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => remove.mutate() },
    ]);
  };
  const busy = save.isPending || remove.isPending;
  const failure = save.error ?? remove.error;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ paddingTop: space.sm, gap: space.block, paddingBottom: space.xxl }}
      >
        <View style={{ paddingHorizontal: space.gutter, gap: space.form }}>
          <Field label="Título" testID="bookmark-title" value={title} onChangeText={setTitle} maxLength={160} invalid={tried && !title.trim()} />
          {item.kind === "link" ? (
            <Field
              label="Link"
              testID="bookmark-url"
              placeholder="https://"
              value={url}
              onChangeText={setUrl}
              maxLength={2048}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="URL"
              invalid={tried && !url.trim()}
            />
          ) : null}
        </View>
        {item.kind === "file" ? (
          <Section header="Arquivo" footer="O arquivo fica como está." inset={space.gutter}>
            <ListRow
              leading={<IconTile icon="doc.fill" color="teal" />}
              title={item.fileName ?? item.title}
              subtitle={item.fileSize ? fileSize(item.fileSize) : undefined}
              onPress={() => void openBookmark(item)}
            />
          </Section>
        ) : item.kind === "board" ? (
          <Section footer="O desenho fica como está." inset={space.gutter}>
            <ListRow leading={<IconTile icon="scribble.variable" color="violet" />} title="Ver a lousa" onPress={() => void openBookmark(item)} />
          </Section>
        ) : null}
        <FolderPicker folders={folders} value={folderId} onChange={setFolder} />
        <View style={{ paddingHorizontal: space.gutter, gap: space.md }}>
          {tried && missing ? <Notice kind="warning">{missing}</Notice> : null}
          {failure ? <Notice kind="error">{errorMessage(failure)}</Notice> : null}
          <Button title={save.isPending ? "Salvando…" : "Salvar"} testID="save-bookmark" busy={save.isPending} disabled={busy} onPress={submit} />
          <Button
            title={remove.isPending ? "Excluindo…" : "Excluir bookmark"}
            variant="plain"
            icon="trash"
            busy={remove.isPending}
            disabled={busy}
            onPress={askDelete}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
