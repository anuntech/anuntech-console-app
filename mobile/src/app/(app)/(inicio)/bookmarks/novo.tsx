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
import { documentsAvailable, type PickedFile } from "@/lib/uploads";
import { api, errorMessage } from "@/lib/api";
import { enqueueUploads, pickArquivos } from "@/lib/arquivos";
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
const kindsFor = (largeFiles: boolean): { value: Kind; label: string; hint: string }[] => [
  { value: "link", label: "Link", hint: "Um endereço na web." },
  {
    value: "file",
    label: "Arquivo",
    hint: largeFiles
      ? "Qualquer tipo, até 100 GB: arquivos, fotos e vídeos do celular, um ou vários de uma vez."
      : documentsAvailable
        ? "Um arquivo ou foto do celular, de até 1 MB."
        : "Uma foto do celular, de até 1 MB.",
  },
  { value: "board", label: "Lousa", hint: "Um quadro para desenhar. A lousa abre no Console para desenhar; no celular você vê o desenho." },
];

/**
 * Adding a link, a file or a blank whiteboard: the web's "Novo bookmark".
 * With R2 (largeFiles), files of any kind up to 100 GB, several at once, go
 * to the upload queue and the list shows their progress; without it, one
 * photo or file of up to 1 MB, as before.
 */
export default function NewBookmark() {
  const params = useLocalSearchParams<{ companyId?: string; folderId?: string; kind?: string }>();
  const choices = useBookmarkChoices();
  const loading = useDelayed(choices.isPending);
  const companies = choices.data?.companies ?? [];
  const folders = choices.data?.folders ?? [];
  const largeFiles = !!choices.data?.largeFiles;
  const kinds = kindsFor(largeFiles);
  const start = params.folderId ? folders.find((f) => f.id === params.folderId) : undefined;
  const [kind, setKind] = useState<Kind>(params.kind === "file" ? "file" : "link");
  // Large mode: the files picked, each sent on its own.
  const [files, setFiles] = useState<PickedFile[]>([]);
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

  const several = largeFiles && kind === "file" && files.length > 1;
  const save = useMutation({
    mutationFn: async () => {
      const fields = { title: title.trim(), companyId: companyId ?? "", folderId };
      if (kind === "file") return uploadBookmarkFile(photo!, fields);
      return api.bookmarks.create({ ...fields, url: kind === "link" ? url.trim() : "", kind });
    },
    onSuccess: async ({ message }) => {
      haptic.success();
      // A blank board has nothing to see here yet: back to the list, which says where to draw.
      showFlash(kind === "board" ? "Lousa criada. Desenhe no Console, no computador." : message);
      await refreshBookmarks();
      router.back();
    },
    onError: () => haptic.error(),
  });

  const missing = !companyId
    ? "Escolha a empresa."
    : !title.trim()
      ? "Informe um título."
      : kind === "link" && !url.trim()
        ? "Informe um link ou selecione um arquivo."
        : kind === "file" && largeFiles && !files.length
          ? "Escolha um arquivo para enviar."
          : kind === "file" && !largeFiles && !photo
            ? "Escolha uma foto para enviar."
            : null;
  const submit = () => {
    setTried(true);
    // Several files keep their own names as titles.
    if (missing && !(several && missing === "Informe um título.")) {
      haptic.error();
      return;
    }
    if (largeFiles && kind === "file") {
      // The queue sends them (two at a time) and the list shows how each goes.
      haptic.select();
      enqueueUploads(files, { companyId: companyId ?? "", folderId }, title.trim());
      router.back();
      return;
    }
    save.mutate();
  };
  const addFiles = async (source: "files" | "library" | "camera") => {
    setFileError(null);
    try {
      const chosen = await pickArquivos(source);
      if (!chosen.length) return;
      haptic.select();
      const next = [...files, ...chosen];
      setFiles(next);
      const named = chosen[0].name.replace(/\.[^.]+$/, "");
      if (next.length === 1 && (!title.trim() || title === fileTitle)) setTitle(named);
      if (next.length === 1) setFileTitle(named);
    } catch (failure) {
      haptic.error();
      setFileError(failure instanceof BookmarkFileError ? failure.message : "Não foi possível abrir os arquivos. Tente novamente.");
    }
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
              {several ? (
                <Text variant="caption" tone="muted">
                  Cada arquivo fica com o próprio nome como título.
                </Text>
              ) : (
              <Field
                label="Título"
                testID="bookmark-title"
                placeholder={kind === "board" ? "Ex.: Fluxo do onboarding" : "Ex.: Identidade visual no Drive"}
                value={title}
                onChangeText={setTitle}
                maxLength={160}
                invalid={tried && !title.trim()}
              />
              )}
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
            {kind === "file" && largeFiles ? (
              <View style={{ gap: space.md }}>
                {files.length ? (
                  <Section header={files.length > 1 ? `${files.length} arquivos` : "Arquivo"} inset={space.gutter}>
                    {files.map((file, i) => (
                      <ListRow
                        key={`${file.uri}-${i}`}
                        leading={
                          <IconTile
                            icon={file.mime.startsWith("video/") ? "video.fill" : file.mime.startsWith("image/") ? "photo.fill" : "doc.fill"}
                            color="teal"
                          />
                        }
                        title={file.name}
                        subtitle={fileSize(file.size)}
                        value="Remover"
                        valueTone="destructive"
                        accessibilityHint="Tirar este arquivo do envio"
                        onPress={() => {
                          haptic.light();
                          const rest = files.filter((_, j) => j !== i);
                          setFiles(rest);
                          // Back to one file: its name is the title, unless one was typed.
                          if (rest.length === 1 && (!title.trim() || title === fileTitle)) {
                            const named = rest[0].name.replace(/\.[^.]+$/, "");
                            setTitle(named);
                            setFileTitle(named);
                          }
                        }}
                      />
                    ))}
                  </Section>
                ) : null}
                <Section header={files.length ? undefined : "Arquivo"} footer={files.length ? undefined : "Qualquer tipo, até 100 GB."} inset={space.gutter}>
                  {documentsAvailable ? (
                    <ListRow leading={<IconTile icon="doc.fill" color="teal" />} title={files.length ? "Mais arquivos" : "Escolher arquivos"} onPress={() => void addFiles("files")} />
                  ) : null}
                  <ListRow leading={<IconTile icon="photo.on.rectangle" color="violet" />} title="Fotos e vídeos da galeria" onPress={() => void addFiles("library")} />
                  <ListRow leading={<IconTile icon="camera.fill" color="gray" />} title="Tirar foto" onPress={() => void addFiles("camera")} />
                </Section>
                {fileError ? (
                  <View style={{ paddingHorizontal: space.gutter }}>
                    <Notice kind="error">{fileError}</Notice>
                  </View>
                ) : null}
              </View>
            ) : kind === "file" ? (
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
              {tried && missing && !(several && missing === "Informe um título.") ? <Notice kind="warning">{missing}</Notice> : null}
              {failure ? <Notice kind="error">{failure}</Notice> : null}
              <Button
                title={
                  busy
                    ? kind === "board"
                      ? "Criando…"
                      : "Adicionando…"
                    : kind === "board"
                      ? "Criar lousa"
                      : several
                        ? `Enviar ${files.length} arquivos`
                        : "Adicionar"
                }
                icon={kind === "board" ? "scribble.variable" : largeFiles && kind === "file" ? "icloud.and.arrow.up" : "plus"}
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
