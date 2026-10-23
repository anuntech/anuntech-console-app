import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { CompanyPicker, FolderPicker } from "@/components/bookmark-pickers";
import { Field } from "@/components/field";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { Segmented } from "@/components/segmented";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { Text } from "@/components/text";
import { IconTile } from "@/components/tile";
import { documentsAvailable } from "@/lib/uploads";
import { api, errorMessage } from "@/lib/api";
import {
  BookmarkFileError,
  pickDocument,
  pickPhoto,
  refreshBookmarks,
  uploadBookmarkFile,
  useBookmarkChoices,
  type PickedPhoto,
} from "@/lib/bookmarks";
import { showFlash } from "@/lib/flash";
import { fileSize } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { space } from "@/lib/theme";

type Kind = "link" | "file" | "board";
const kinds: { value: Kind; label: string; hint: string }[] = [
  { value: "link", label: "Link", hint: "Um endereço na web." },
  { value: "file", label: "Arquivo", hint: documentsAvailable ? "Um arquivo ou foto do celular, de até 1 MB." : "Uma foto do celular, de até 1 MB." },
  { value: "board", label: "Lousa", hint: "Um quadro para desenhar. A lousa abre no Console para desenhar; no celular você vê o desenho." },
];

/** Adding a link, a photo as a file, or a blank whiteboard: the web's "Novo bookmark". */
export default function NewBookmark() {
  const params = useLocalSearchParams<{ companyId?: string; folderId?: string }>();
  const choices = useBookmarkChoices();
  const loading = useDelayed(choices.isPending);
  const companies = choices.data?.companies ?? [];
  const folders = choices.data?.folders ?? [];
  const start = params.folderId ? folders.find((f) => f.id === params.folderId) : undefined;
  const [kind, setKind] = useState<Kind>("link");
  const [picked, setCompany] = useState<string>();
  const [folderChoice, setFolder] = useState<string>();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  // The title taken from the last file's name, so a new file can replace it (and a typed one stays).
  const [fileTitle, setFileTitle] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  // The folder the list was showing decides the company; otherwise the one picked, or the only one.
  const companyId =
    picked ?? start?.companyId ?? (params.companyId || undefined) ?? (companies.length === 1 ? companies[0].id : undefined);
  const folderId = folderChoice ?? (start && start.companyId === companyId ? start.id : "");
  const options = folders.filter((f) => f.companyId === companyId);

  const save = useMutation({
    mutationFn: async () => {
      const fields = { title: title.trim(), companyId: companyId ?? "", folderId };
      if (kind === "file") return uploadBookmarkFile(photo!, fields);
      return api.bookmarks.create({ ...fields, url: kind === "link" ? url.trim() : "", kind });
    },
    onSuccess: async ({ id, message }) => {
      haptic.success();
      showFlash(message);
      await refreshBookmarks();
      if (kind === "board")
        router.replace({ pathname: "/bookmarks/[id]/lousa", params: { id, title: title.trim(), v: "" } });
      else router.back();
    },
    onError: () => haptic.error(),
  });

  const missing = !companyId
    ? "Escolha a empresa."
    : !title.trim()
      ? "Informe um título."
      : kind === "link" && !url.trim()
        ? "Informe um link ou selecione um arquivo."
        : kind === "file" && !photo
          ? "Escolha uma foto para enviar."
          : null;
  const submit = () => {
    setTried(true);
    if (missing) {
      haptic.error();
      return;
    }
    save.mutate();
  };
  const choosePhoto = async (source: "camera" | "library" | "files") => {
    setFileError(null);
    try {
      const chosen = source === "files" ? await pickDocument() : await pickPhoto(source);
      if (!chosen) return;
      haptic.select();
      setPhoto(chosen);
      const named = chosen.name.replace(/\.[^.]+$/, "");
      if (!title.trim() || title === fileTitle) setTitle(named);
      setFileTitle(named);
    } catch (failure) {
      haptic.error();
      setFileError(failure instanceof BookmarkFileError ? failure.message : "Não foi possível abrir as fotos. Tente novamente.");
    }
  };
  const busy = save.isPending;
  const index = kinds.findIndex((k) => k.value === kind);
  const failure = save.error ? (save.error instanceof BookmarkFileError ? save.error.message : errorMessage(save.error)) : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ paddingTop: space.sm, gap: space.block, paddingBottom: space.xxl }}
      >
        {loading ? <SkeletonRows count={4} /> : null}
        {choices.error && !choices.data ? (
          <View style={{ paddingHorizontal: space.gutter }}>
            <Notice kind="error">{errorMessage(choices.error)}</Notice>
          </View>
        ) : null}
        {choices.data ? (
          <>
            <View style={{ paddingHorizontal: space.gutter, gap: space.sm }}>
              <Text variant="label" accessible={false}>
                Tipo
              </Text>
              <Segmented
                values={kinds.map((k) => k.label)}
                selectedIndex={index}
                accessibilityLabel="Tipo"
                onChange={(i) => setKind(kinds[i].value)}
              />
              <Text variant="caption" tone="muted">
                {kinds[index].hint}
              </Text>
            </View>
            <CompanyPicker
              companies={companies}
              value={companyId ?? ""}
              onChange={(id) => {
                setCompany(id);
                if (id !== companyId) setFolder("");
              }}
            />
            <View style={{ paddingHorizontal: space.gutter, gap: space.form }}>
              <Field
                label="Título"
                testID="bookmark-title"
                placeholder={kind === "board" ? "Ex.: Fluxo do onboarding" : "Ex.: Identidade visual no Drive"}
                value={title}
                onChangeText={setTitle}
                maxLength={160}
                invalid={tried && !title.trim()}
              />
              {kind === "link" ? (
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
            {kind === "file" ? (
              <View style={{ gap: space.md }}>
                {photo ? (
                  <Section header="Arquivo" inset={space.gutter}>
                    <ListRow
                      leading={<IconTile icon={photo.mime.startsWith("image/") ? "photo.fill" : "doc.fill"} color="teal" />}
                      title={photo.name}
                      subtitle={fileSize(photo.size)}
                      value="Trocar"
                      valueTone="primary"
                      accessibilityHint={documentsAvailable ? "Escolher outro arquivo ou foto" : "Escolher outra foto"}
                      onPress={() => {
                        // Back to the choices (arquivo, galeria, câmera), wherever this one came from.
                        haptic.select();
                        setFileError(null);
                        setPhoto(null);
                      }}
                    />
                  </Section>
                ) : (
                  <Section
                    header="Arquivo"
                    footer={documentsAvailable ? "Até 1 MB." : "No celular dá para enviar fotos. Outros arquivos, pelo Console no computador."}
                    inset={space.gutter}
                  >
                    {documentsAvailable ? (
                      <ListRow leading={<IconTile icon="doc.fill" color="teal" />} title="Escolher arquivo" onPress={() => void choosePhoto("files")} />
                    ) : null}
                    <ListRow leading={<IconTile icon="photo.on.rectangle" color="violet" />} title="Escolher da galeria" onPress={() => void choosePhoto("library")} />
                    <ListRow leading={<IconTile icon="camera.fill" color="gray" />} title="Tirar foto" onPress={() => void choosePhoto("camera")} />
                  </Section>
                )}
                {fileError ? (
                  <View style={{ paddingHorizontal: space.gutter }}>
                    <Notice kind="error">{fileError}</Notice>
                  </View>
                ) : null}
              </View>
            ) : null}
            {companyId ? <FolderPicker folders={options} value={folderId} onChange={setFolder} /> : null}
            <View style={{ paddingHorizontal: space.gutter, gap: space.md }}>
              {tried && missing ? <Notice kind="warning">{missing}</Notice> : null}
              {failure ? <Notice kind="error">{failure}</Notice> : null}
              <Button
                title={busy ? (kind === "board" ? "Criando…" : "Adicionando…") : kind === "board" ? "Criar lousa" : "Adicionar bookmark"}
                icon={kind === "board" ? "scribble.variable" : "plus"}
                testID="save-bookmark"
                busy={busy}
                onPress={submit}
              />
            </View>
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
