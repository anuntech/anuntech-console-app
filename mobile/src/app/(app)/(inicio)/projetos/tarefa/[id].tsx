import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AttachmentField, type Attachment } from "@/components/attachment-field";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { ListRow } from "@/components/list-row";
import { PickSheet } from "@/components/pick-sheet";
import { Pill } from "@/components/pill";
import { Section } from "@/components/section";
import { Sheet } from "@/components/sheet";
import { SkeletonHeader, SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { TaskReviewSheet, type ReviewTarget } from "@/components/task-review-sheet";
import { Text } from "@/components/text";
import { api, errorMessage } from "@/lib/api";
import { openAttachment } from "@/lib/files";
import { clearFlash, showFlash, useFlash } from "@/lib/flash";
import { civilDate, fileSize, when } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { useTabBarSpace } from "@/lib/layout";
import { HeaderIconButton } from "@/lib/stack";
import type { ToneName } from "@/lib/status";
import { relativeLabel } from "@/lib/tasks";
import { fonts, rounded, space, usePalette } from "@/lib/theme";

type Detail = Awaited<ReturnType<typeof api.projects.task>>;
type Comment = Detail["comments"][number];
type File = Detail["files"][number];

/** Files per comment, as the server takes them (DOCUMENT_ATTACHMENTS). */
const MAX_FILES = 5;

const statusLook: Record<string, { tone: ToneName; icon: SFSymbol }> = {
  backlog: { tone: "neutral", icon: "tray.fill" },
  todo: { tone: "neutral", icon: "circle" },
  in_progress: { tone: "info", icon: "circle.lefthalf.filled" },
  review: { tone: "attention", icon: "eye.fill" },
  done: { tone: "good", icon: "checkmark.circle.fill" },
};

function open(file: { href: string; name: string }) {
  void openAttachment(file.href, file.name).catch(() =>
    Alert.alert("Não foi possível abrir o anexo", "Confira a internet e tente de novo."),
  );
}

/** A file in a list: tapping downloads it and opens the share sheet. */
function FileRow({ file, onRemove }: { file: { name: string; size: number; mime: string; href: string }; onRemove?: () => void }) {
  const palette = usePalette();
  return (
    <ListRow
      leading={
        <View style={{ width: 32, height: 32, ...rounded(8), backgroundColor: palette.accent, alignItems: "center", justifyContent: "center" }}>
          <SymbolView name={file.mime.startsWith("image/") ? "photo" : "doc.fill"} size={16} tintColor={palette.primary} accessible={false} />
        </View>
      }
      title={
        <Text numberOfLines={1} variant="label">
          {file.name}
        </Text>
      }
      subtitle={fileSize(file.size)}
      accessibilityLabel={`Anexo ${file.name}, ${fileSize(file.size)}`}
      accessibilityHint="Baixa e abre o arquivo"
      onPress={() => open(file)}
      trailing={
        onRemove ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${file.name}`} hitSlop={10} onPress={onRemove} style={{ padding: 4 }}>
            <SymbolView name="trash" size={17} tintColor={palette.destructive} accessible={false} />
          </Pressable>
        ) : (
          <SymbolView name="arrow.down.circle" size={18} tintColor={palette.primary} accessible={false} />
        )
      }
    />
  );
}

/** One comment: who, when, "editado", the words and its files; the author's actions behind "…". */
function CommentItem({ comment, onActions }: { comment: Comment; onActions?: () => void }) {
  const palette = usePalette();
  const name = comment.mine ? "Você" : comment.author.name;
  return (
    <View style={{ flexDirection: "row", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md }}>
      <Avatar avatar={comment.author.avatar} name={comment.author.name} size={32} />
      <View style={{ flex: 1, gap: space.xs }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Text
            variant="caption"
            tone="muted"
            style={{ flex: 1 }}
            accessibilityLabel={`${name}, ${when(comment.createdAt)}${comment.editedAt ? ", editado" : ""}`}
          >
            <Text variant="caption" style={{ fontFamily: fonts.semibold, color: palette.foreground }}>
              {name}
            </Text>
            {` · ${relativeLabel(comment.createdAt)}${comment.editedAt ? " · editado" : ""}`}
          </Text>
          {onActions ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Ações do comentário" hitSlop={10} onPress={onActions} style={{ padding: 2 }}>
              <SymbolView name="ellipsis" size={16} tintColor={palette.muted} accessible={false} />
            </Pressable>
          ) : null}
        </View>
        {comment.body ? <Text selectable>{comment.body}</Text> : null}
        {comment.files.map((file) => (
          <Pressable
            key={file.id}
            accessibilityRole="button"
            accessibilityLabel={`Anexo ${file.name}, ${fileSize(file.size)}`}
            onPress={() => open(file)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: space.sm,
              padding: space.sm,
              ...rounded(12),
              backgroundColor: pressed ? palette.fill : palette.secondary,
            })}
          >
            <SymbolView name={file.mime.startsWith("image/") ? "photo" : "doc.fill"} size={14} tintColor={palette.primary} accessible={false} />
            <Text variant="caption" numberOfLines={1} style={{ flex: 1 }}>
              {file.name}
            </Text>
            <Text variant="caption" tone="muted">
              {fileSize(file.size)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Writing a comment (text, files or both) or changing the words of one's own. */
function CommentSheet({
  taskId,
  engagementId,
  editing,
  visible,
  onClose,
  onDone,
}: {
  taskId: string;
  engagementId: string;
  editing: Comment | null;
  visible: boolean;
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [shown, setShown] = useState<Comment | null | undefined>(undefined);
  // A new opening starts from the comment being edited, or empty.
  if (visible && shown !== editing) {
    setShown(editing);
    setBody(editing?.body ?? "");
    setFiles([]);
  }
  const uploading = files.some((file) => file.state === "uploading");
  const uploadIds = files.flatMap((file) => (file.uploadId ? [file.uploadId] : []));
  const send = useMutation({
    mutationFn: () =>
      editing ? api.projects.editComment({ id: editing.id, body: body.trim() }) : api.projects.comment({ taskId, body: body.trim(), uploadIds }),
    onSuccess: async ({ message }) => {
      haptic.success();
      onClose();
      setShown(undefined);
      await onDone(message);
    },
    onError: () => haptic.error(),
  });
  const ready = !uploading && !files.some((file) => file.state === "error") && (editing ? true : !!body.trim() || uploadIds.length > 0);
  return (
    <Sheet
      visible={visible}
      onClose={() => {
        send.reset();
        setShown(undefined);
        onClose();
      }}
      title={editing ? "Editar comentário" : "Comentar"}
      busy={send.isPending}
    >
      <Field
        label="Comentário"
        testID="comment-body"
        placeholder="Escreva um comentário…"
        value={body}
        onChangeText={setBody}
        multiline
        autoFocus
        maxLength={5000}
        editable={!send.isPending}
        style={{ minHeight: 120, paddingTop: space.md, textAlignVertical: "top" }}
      />
      {editing ? null : <AttachmentField value={files} onChange={setFiles} target={{ kind: "task", engagementId }} max={MAX_FILES} />}
      {send.error ? <Notice kind="error">{errorMessage(send.error)}</Notice> : null}
      <Button
        testID="send-comment"
        title={send.isPending ? (editing ? "Salvando…" : "Publicando…") : editing ? "Salvar" : "Comentar"}
        icon={editing ? "checkmark" : "paperplane.fill"}
        busy={send.isPending}
        disabled={!ready}
        onPress={() => send.mutate()}
      />
    </Sheet>
  );
}

/**
 * One task (projects.task): every field, the column (with the client's
 * rules), files, the review of a delivery and the comments. Editing opens
 * the form; deleting asks first.
 */
export default function Task() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const queryClient = useQueryClient();
  const flash = useFlash();
  const task = useQuery({ queryKey: ["task", id], queryFn: () => api.projects.task({ id }) });
  const loading = useDelayed(task.isPending);
  const [moving, setMoving] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [reviewing, setReviewing] = useState<ReviewTarget | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  // A message from the form (saved, created) stays while this screen is open;
  // "Tarefa excluída." outlives it, for the board it returns to.
  const deleted = useRef(false);
  useEffect(
    () => () => {
      if (!deleted.current) clearFlash();
    },
    [],
  );
  const t = task.data;
  const projectId = t?.project.id;
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["task", id] }),
      queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["project-activity", projectId] }),
      // An approved or returned delivery leaves Início's "Precisa de atenção".
      queryClient.invalidateQueries({ queryKey: ["overview"] }),
    ]);
  };
  const said = async (text: string) => {
    clearFlash();
    setNotice({ kind: "success", text });
    await refresh();
  };
  const failed = (error: unknown) => {
    haptic.error();
    clearFlash();
    setNotice({ kind: "error", text: errorMessage(error) });
  };
  const move = useMutation({
    mutationFn: (status: Detail["status"]) => api.projects.moveTask({ id, status }),
    onSuccess: async ({ message }) => {
      haptic.success();
      await said(message);
    },
    onError: failed,
  });
  const removeFile = useMutation({
    mutationFn: (fileId: string) => api.projects.removeTaskFile({ id: fileId }),
    onSuccess: async ({ message }) => {
      haptic.success();
      await said(message);
    },
    onError: failed,
  });
  const deleteComment = useMutation({
    mutationFn: (commentId: string) => api.projects.deleteComment({ id: commentId }),
    onSuccess: async ({ message }) => {
      haptic.success();
      await said(message);
    },
    onError: failed,
  });
  const remove = useMutation({
    mutationFn: () => api.projects.deleteTask({ id }),
    onSuccess: async ({ message }) => {
      haptic.success();
      deleted.current = true;
      showFlash(message);
      queryClient.removeQueries({ queryKey: ["task", id] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["project-activity", projectId] }),
      ]);
      router.back();
    },
    onError: failed,
  });
  const confirmDelete = () => {
    if (!t) return;
    haptic.medium();
    Alert.alert("Excluir tarefa?", `"${t.title}" sai do quadro, com os anexos. Isso não pode ser desfeito.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => remove.mutate() },
    ]);
  };
  const confirmRemoveFile = (file: File) => {
    haptic.medium();
    Alert.alert("Remover anexo?", `"${file.name}" sai da tarefa para todo mundo.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => removeFile.mutate(file.id) },
    ]);
  };
  const commentActions = (comment: Comment) => {
    haptic.light();
    const confirm = () =>
      Alert.alert("Excluir comentário?", "O comentário sai da tarefa para todo mundo. Isso não pode ser desfeito.", [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: () => deleteComment.mutate(comment.id) },
      ]);
    if (!comment.canEdit) return confirm();
    Alert.alert("Comentário", undefined, [
      {
        text: "Editar",
        onPress: () => {
          setEditingComment(comment);
          setCommenting(true);
        },
      },
      { text: "Excluir", style: "destructive", onPress: confirm },
      { text: "Cancelar", style: "cancel" },
    ]);
  };
  const look = t ? (statusLook[t.status] ?? statusLook.todo) : null;
  const canMove = !!t && t.statuses.length > 1;
  return (
    <>
      <Stack.Screen
        options={{
          headerRight: t
            ? () => (
                <HeaderIconButton
                  symbol="pencil"
                  label="Editar tarefa"
                  tint="primary"
                  testID="edit-task"
                  onPress={() => {
                    clearFlash();
                    router.push({ pathname: "/projetos/tarefa/editar", params: { id } });
                  }}
                />
              )
            : undefined,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: palette.background }}
        contentContainerStyle={{ padding: space.gutter, gap: space.block, paddingBottom: bottom }}
        scrollIndicatorInsets={{ bottom }}
        refreshControl={<RefreshControl refreshing={task.isRefetching} onRefresh={() => void task.refetch()} />}
      >
        {loading ? (
          <>
            <SkeletonHeader />
            <SkeletonRows count={4} inset={0} />
          </>
        ) : null}
        {task.error ? <Notice kind="error">{errorMessage(task.error)}</Notice> : null}
        {t && look ? (
          <>
            <View style={{ gap: space.sm }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                <Pill label={t.statusLabel} tone={look.tone} icon={look.icon} />
                {t.requested ? <Pill label="Pedido do cliente" tone="attention" /> : null}
              </View>
              <Text variant="title" accessibilityRole="header" selectable>
                {t.title}
              </Text>
              <Text variant="subhead" tone="muted">
                {[t.project.name, t.creator ? `Criada por ${t.creator}` : null, `atualizada ${relativeLabel(t.updatedAt)}`].filter(Boolean).join(" · ")}
              </Text>
            </View>
            {flash ? <Notice kind="success">{flash.text}</Notice> : null}
            {notice ? <Notice kind={notice.kind}>{notice.text}</Notice> : null}
            {t.status === "review" && (t.canReview || t.reviewDue) ? (
              <View style={{ gap: space.md }}>
                <Notice kind="warning" title={t.canReview ? "Aguardando sua revisão" : "Em Revisão"}>
                  {t.reviewDue ? `Teste até ${when(t.reviewDue)}.` : "Pronta para testar."}
                </Notice>
                {t.canReview ? (
                  <Button
                    title="Revisar"
                    icon="checklist"
                    testID="review-task"
                    onPress={() => {
                      haptic.light();
                      setNotice(null);
                      setReviewing({ id: t.id, title: t.title, reviewDue: t.reviewDue });
                    }}
                  />
                ) : null}
              </View>
            ) : null}
            {t.requested && t.status === "backlog" ? (
              <Notice kind="info">Pedido no Backlog. A equipe confirma se ele faz parte do combinado.</Notice>
            ) : null}
            {t.description?.trim() ? (
              <View style={{ gap: space.sm }}>
                <Text variant="label" accessibilityRole="header">
                  Descrição
                </Text>
                <Text selectable>{t.description.trim()}</Text>
              </View>
            ) : null}
            <Section indent={16}>
              <ListRow
                title="Coluna"
                value={move.isPending ? "Movendo…" : t.statusLabel}
                valueTone={canMove ? "primary" : "muted"}
                testID="task-status"
                accessibilityLabel={`Coluna, ${t.statusLabel}`}
                accessibilityHint={canMove ? "Muda a tarefa de coluna" : undefined}
                onPress={canMove && !move.isPending ? () => setMoving(true) : undefined}
              />
              <ListRow title="Prioridade" value={t.priorityLabel} />
              <ListRow
                title="Responsáveis"
                subtitle={t.assignees.length ? t.assignees.map((person) => person.name).join(", ") : "Ninguém ainda"}
                trailing={
                  t.assignees.length ? (
                    <View style={{ flexDirection: "row" }}>
                      {t.assignees.slice(0, 3).map((person, i) => (
                        <View key={person.id} style={{ marginLeft: i ? -8 : 0, borderRadius: 14, borderWidth: 2, borderColor: palette.card }}>
                          <Avatar avatar={person.avatar} name={person.name} size={24} />
                        </View>
                      ))}
                    </View>
                  ) : (
                    "none"
                  )
                }
              />
              <ListRow
                title="Prazo"
                value={t.dueDate ? (t.overdue ? `Atrasada · ${civilDate(t.dueDate)}` : t.dueToday ? "Hoje" : civilDate(t.dueDate)) : "Sem prazo"}
                valueTone={t.overdue ? "destructive" : "muted"}
              />
              <ListRow title="Estimativa" value={t.estimateLabel ?? "Sem estimativa"} />
              <ListRow
                title="Etiquetas"
                subtitle={
                  t.labels.length ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                      {t.labels.map((label) => (
                        <Pill key={label} label={label} />
                      ))}
                    </View>
                  ) : (
                    "Nenhuma"
                  )
                }
                accessibilityLabel={`Etiquetas, ${t.labels.length ? t.labels.join(", ") : "nenhuma"}`}
              />
            </Section>
            <Section header={t.files.length ? `Anexos · ${t.files.length}` : "Anexos"} indent={60}>
              {t.files.map((file) => (
                <FileRow key={file.id} file={file} onRemove={file.canRemove ? () => confirmRemoveFile(file) : undefined} />
              ))}
              <ListRow
                leading={<SymbolView name="paperclip" size={18} tintColor={palette.primary} accessible={false} style={{ width: 32 }} />}
                title="Anexar arquivos"
                tone="primary"
                accessibilityHint="Abre a edição da tarefa"
                onPress={() => {
                  clearFlash();
                  router.push({ pathname: "/projetos/tarefa/editar", params: { id } });
                }}
              />
            </Section>
            <View style={{ gap: space.sm }}>
              <Text variant="caption" tone="muted" accessibilityRole="header" style={{ fontFamily: fonts.semibold, marginHorizontal: 16 }}>
                {t.comments.length ? `Comentários · ${t.comments.length}` : "Comentários"}
              </Text>
              <View style={{ backgroundColor: palette.card, ...rounded(24), overflow: "hidden", paddingVertical: space.xs }}>
                {t.comments.length ? (
                  t.comments.map((comment) => (
                    <CommentItem
                      key={comment.id}
                      comment={comment}
                      onActions={comment.canEdit || comment.canDelete ? () => commentActions(comment) : undefined}
                    />
                  ))
                ) : (
                  <View style={{ padding: space.lg, gap: space.xs }}>
                    <Text variant="label">Nenhum comentário ainda</Text>
                    <Text variant="subhead" tone="muted">
                      O que for combinado sobre esta tarefa fica registrado aqui.
                    </Text>
                  </View>
                )}
              </View>
              <Button
                title="Comentar"
                variant="secondary"
                icon="text.bubble"
                testID="comment-task"
                onPress={() => {
                  haptic.light();
                  setEditingComment(null);
                  setCommenting(true);
                }}
              />
            </View>
            {t.canDelete ? (
              <Button
                title={remove.isPending ? "Excluindo…" : "Excluir tarefa"}
                variant="plain"
                icon="trash"
                testID="delete-task"
                busy={remove.isPending}
                onPress={confirmDelete}
              />
            ) : null}
            <PickSheet
              visible={moving}
              title="Coluna"
              subtitle={t.title}
              options={t.statuses}
              selected={[t.status]}
              footer={
                // Fewer than every column: the client's rules apply.
                t.statuses.length < 5
                  ? "Só a equipe conclui uma tarefa ou a coloca em Revisão. Um pedido fica no Backlog até a equipe confirmar."
                  : undefined
              }
              onChange={([status]) => {
                if (status && status !== t.status) {
                  setNotice(null);
                  move.mutate(status as Detail["status"]);
                }
              }}
              onClose={() => setMoving(false)}
            />
            <CommentSheet
              taskId={t.id}
              engagementId={t.project.id}
              editing={editingComment}
              visible={commenting}
              onClose={() => setCommenting(false)}
              onDone={said}
            />
            <TaskReviewSheet task={reviewing} onClose={() => setReviewing(null)} onDone={said} />
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
