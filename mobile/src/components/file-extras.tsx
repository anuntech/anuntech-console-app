import { useState } from "react";
import { ActivityIndicator, Alert } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { pickArquivos, sendToR2 } from "@/lib/arquivos";
import { TAG_LABELS } from "@/lib/bookmark-text";
import { refreshBookmarks, type Bookmark } from "@/lib/bookmarks";
import { openSignedFile } from "@/lib/files";
import { fileSize, when } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { space, usePalette } from "@/lib/theme";
import { documentsAvailable } from "@/lib/uploads";
import { ListRow } from "./list-row";
import { PickSheet } from "./pick-sheet";
import { Section } from "./section";
import { IconTile } from "./tile";

const TAG_OPTIONS = [{ value: "", label: "Sem etiqueta" }, ...Object.entries(TAG_LABELS).map(([value, label]) => ({ value, label }))];

/** "Etiqueta": the web's list; the Console's suggestion is said as such, and a person's choice stays. */
export function TagField({ value, suggested, onChange }: { value: string; suggested: boolean; onChange: (tag: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Section
        header="Etiqueta"
        footer={suggested && value ? "Sugerida pelo Console a partir do nome e do conteúdo. Troque se não servir." : "Para filtrar a lista por tipo de documento."}
        inset={space.gutter}
      >
        <ListRow leading={<IconTile icon="tag" color="violet" />} title={value ? (TAG_LABELS[value] ?? value) : "Sem etiqueta"} trailing="chevron" onPress={() => setOpen(true)} />
      </Section>
      <PickSheet visible={open} onClose={() => setOpen(false)} title="Etiqueta" options={TAG_OPTIONS} selected={[value]} onChange={([tag]) => onChange(tag ?? "")} />
    </>
  );
}

/**
 * "Versões": the earlier files, each to download or bring back, and "Enviar
 * nova versão" (the file goes to R2 from the phone; the current one is kept).
 */
export function FileVersions({ item }: { item: Bookmark }) {
  const palette = usePalette();
  const versions = useQuery({ queryKey: ["bookmark-versions", item.id], queryFn: () => api.bookmarks.versions({ id: item.id }) });
  const [sending, setSending] = useState(false);
  const after = async (message: string) => {
    haptic.success();
    Alert.alert("Pronto", message);
    await Promise.all([versions.refetch(), refreshBookmarks()]);
  };
  const restore = useMutation({
    mutationFn: (versionId: string) => api.bookmarks.restoreVersion({ versionId }),
    onSuccess: ({ message }) => after(message),
    onError: (error) => {
      haptic.error();
      Alert.alert("Não foi possível restaurar", errorMessage(error));
    },
  });
  const sendNew = async () => {
    try {
      const [file] = await pickArquivos(documentsAvailable ? "files" : "library");
      if (!file) return;
      setSending(true);
      const uploadId = await sendToR2(file, { companyId: item.companyId ?? "", folderId: item.folderId ?? "" }, () => undefined, new AbortController().signal);
      const { message } = await api.bookmarks.replaceFile({ id: item.id, uploadId });
      await after(message);
    } catch (error) {
      haptic.error();
      Alert.alert("Não foi possível enviar", errorMessage(error));
    } finally {
      setSending(false);
    }
  };
  const open = async (versionId: string, name: string) => {
    try {
      const { url, fileName } = await api.bookmarks.downloadVersion({ id: item.id, versionId });
      await openSignedFile(url, `versao-${versionId}`, fileName || name);
    } catch (error) {
      Alert.alert("Não foi possível abrir", errorMessage(error));
    }
  };
  const editable = !!versions.data?.editable;
  const rows = versions.data?.versions ?? [];
  return (
    <Section
      header="Versões"
      footer={rows.length ? "Toque numa versão para baixar ou restaurar. Nada se perde: a atual vira uma versão." : "Ainda não há versões anteriores."}
      inset={space.gutter}
    >
      {editable ? (
        <ListRow
          leading={<IconTile icon="arrow.up.doc" color="teal" />}
          title={sending ? "Enviando…" : "Enviar nova versão"}
          trailing={sending ? <ActivityIndicator size="small" color={palette.muted} /> : "none"}
          onPress={sending ? undefined : () => void sendNew()}
        />
      ) : null}
      {rows.map((v) => (
        <ListRow
          key={v.id}
          title={`Versão ${v.version}`}
          subtitle={[v.fileName, fileSize(v.fileSize), v.by ? `por ${v.by}` : null, when(v.createdAt)].filter(Boolean).join(" · ")}
          trailing="chevron"
          onPress={() =>
            Alert.alert(`Versão ${v.version}`, v.fileName, [
              { text: "Cancelar", style: "cancel" },
              ...(editable ? [{ text: "Restaurar", onPress: () => restore.mutate(v.id) }] : []),
              { text: "Baixar", onPress: () => void open(v.id, v.fileName) },
            ])
          }
        />
      ))}
    </Section>
  );
}

/** "Atividade": who added, changed, sent a version, made a link or downloaded, newest first (who may edit it). */
export function FileActivity({ item }: { item: Bookmark }) {
  const activity = useQuery({ queryKey: ["bookmark-activity", item.id], queryFn: () => api.bookmarks.activity({ id: item.id }), enabled: item.editable });
  if (!item.editable || !activity.data?.activity.length) return null;
  return (
    <Section header="Atividade" inset={space.gutter}>
      {activity.data.activity.slice(0, 20).map((row) => (
        <ListRow key={row.id} title={`${row.who ?? "Alguém"} · ${row.what}${row.note ? ` (${row.note})` : ""}`} subtitle={when(row.at)} />
      ))}
    </Section>
  );
}
