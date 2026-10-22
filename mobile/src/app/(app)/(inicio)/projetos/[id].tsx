import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Text } from "@/components/text";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Sheet } from "@/components/sheet";
import { Notice } from "@/components/surface";
import { Pill } from "@/components/pill";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { EmptyState } from "@/components/empty-state";
import { SkeletonHeader, SkeletonRows, useDelayed } from "@/components/skeleton";
import { api, errorMessage } from "@/lib/api";
import { civilDate, when } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { useTabBarSpace } from "@/lib/layout";
import { fonts, rounded, space, usePalette, type Palette } from "@/lib/theme";

/** Hairlines start where the task title does: 16 padding, a 24 symbol, 12 gap. */
const TASK_INDENT = 52;

type Board = Awaited<ReturnType<typeof api.projects.get>>;
type Task = Board["columns"][number]["tasks"][number];

/** Each column's symbol and color: open circles still to do, a half circle in progress, a check when done. */
function columnLook(palette: Palette, status: string): { icon: SFSymbol; color: string; bar: string } {
  if (status === "in_progress") return { icon: "circle.lefthalf.filled", color: palette.primary, bar: palette.primary };
  if (status === "review") return { icon: "eye.circle.fill", color: palette.warning, bar: palette.warning };
  if (status === "done") return { icon: "checkmark.circle.fill", color: palette.success, bar: palette.success };
  return { icon: "circle", color: palette.tertiary, bar: palette.fill };
}

/** The board's progress: one segment per column that has tasks, as wide as its share. */
function Progress({ columns }: { columns: Board["columns"] }) {
  const palette = usePalette();
  const filled = columns.filter((column) => column.tasks.length > 0);
  const total = filled.reduce((sum, column) => sum + column.tasks.length, 0);
  const done = columns.find((column) => column.status === "done")?.tasks.length ?? 0;
  if (!total) return null;
  return (
    <View accessible accessibilityLabel={`${done} de ${total} tarefas concluídas`} style={{ gap: space.sm }}>
      <Text variant="caption" tone="muted">
        {done} de {total} concluídas
      </Text>
      <View style={{ flexDirection: "row", gap: 2, height: 6, ...rounded(999), overflow: "hidden" }}>
        {filled.map((column) => (
          <View key={column.status} style={{ flex: column.tasks.length, backgroundColor: columnLook(palette, column.status).bar }} />
        ))}
      </View>
    </View>
  );
}

/** One task as a row: what it is, who has it, when it is due, and whether it waits for the client. */
function TaskRow({ task, status, onPress }: { task: Task; status: string; onPress?: () => void }) {
  const palette = usePalette();
  const look = columnLook(palette, status);
  const done = status === "done";
  const details = [
    task.assignees.length ? task.assignees.join(", ") : null,
    task.dueDate ? `Prazo ${civilDate(task.dueDate)}` : null,
    task.comments ? `${task.comments} comentário${task.comments > 1 ? "s" : ""}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const description = task.description?.trim();
  const review = task.reviewDue ? `Aguardando sua revisão até ${when(task.reviewDue)}` : null;
  return (
    <ListRow
      leading={<SymbolView name={look.icon} size={20} tintColor={look.color} accessible={false} style={{ width: 24, height: 24 }} />}
      title={
        <Text tone={done ? "muted" : "foreground"} numberOfLines={2}>
          {task.title}
        </Text>
      }
      subtitle={
        description ? (
          <Text variant="caption" tone="muted" numberOfLines={3}>
            {description}
          </Text>
        ) : undefined
      }
      meta={
        details || review ? (
          <View style={{ gap: 4 }}>
            {details ? (
              <Text variant="caption" tone="muted">
                {details}
              </Text>
            ) : null}
            {review ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <SymbolView name="clock.badge.exclamationmark" size={12} tintColor={palette.warning} accessible={false} />
                <Text variant="caption" tone="warning" style={{ flexShrink: 1, fontFamily: fonts.semibold }}>
                  {review}
                </Text>
              </View>
            ) : null}
          </View>
        ) : undefined
      }
      accessibilityLabel={[task.title, description, details, review].filter(Boolean).join(", ")}
      accessibilityHint={onPress ? "Abre a revisão da entrega" : undefined}
      onPress={onPress}
    />
  );
}

type Decision = "approve" | "problem";

/**
 * Reviewing a delivery, as the web's TaskReviewDialog: approve it, or say
 * what is missing (required) and it goes back to the team.
 */
function ReviewSheet({
  task,
  onClose,
  onDone,
}: {
  task: Task | null;
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
}) {
  const [problem, setProblem] = useState(false);
  const [note, setNote] = useState("");
  const review = useMutation({
    mutationFn: (input: { id: string; decision: Decision; note: string }) => api.projects.reviewTask(input),
    onSuccess: async ({ message }) => {
      haptic.success();
      setProblem(false);
      setNote("");
      onClose();
      await onDone(message);
    },
    onError: () => haptic.error(),
  });
  const pending = review.isPending;
  const close = () => {
    setProblem(false);
    setNote("");
    review.reset();
    onClose();
  };
  const send = (decision: Decision) => {
    if (!task || pending) return;
    haptic.medium();
    review.mutate({ id: task.id, decision, note: decision === "problem" ? note.trim() : "" });
  };
  return (
    <Sheet
      visible={!!task}
      onClose={close}
      title="Revisar entrega"
      subtitle={task ? `${task.title}${task.reviewDue ? ` · teste até ${when(task.reviewDue)}` : ""}` : undefined}
      busy={pending}
    >
      {problem ? (
        <Field
          label="O que não funcionou"
          testID="problem-note"
          placeholder="O que você testou e o que não funcionou como esperado."
          value={note}
          onChangeText={setNote}
          multiline
          autoFocus
          maxLength={5000}
          editable={!pending}
          style={{ minHeight: 140, textAlignVertical: "top" }}
        />
      ) : (
        <Text variant="subhead" tone="muted">
          Teste a entrega. Se estiver como combinado, aprove; se não, conte o que falta e ela volta para a equipe.
        </Text>
      )}
      {review.error ? <Notice kind="error">{errorMessage(review.error)}</Notice> : null}
      {problem ? (
        <View style={{ gap: space.xs }}>
          <Button
            testID="send-problem"
            title={pending ? "Enviando…" : "Enviar para a equipe"}
            icon="exclamationmark.triangle.fill"
            busy={pending}
            disabled={!note.trim()}
            onPress={() => send("problem")}
          />
          <Button
            title="Voltar"
            variant="plain"
            disabled={pending}
            onPress={() => {
              review.reset();
              setProblem(false);
            }}
          />
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          <Button
            testID="approve-task"
            title={pending ? "Aprovando…" : "Aprovar"}
            icon="checkmark"
            busy={pending}
            onPress={() => send("approve")}
          />
          <Button
            testID="report-problem"
            title="Encontrei um problema"
            variant="secondary"
            disabled={pending}
            onPress={() => {
              haptic.select();
              review.reset();
              setProblem(true);
            }}
          />
        </View>
      )}
    </Sheet>
  );
}

/** One project's board, column by column (projects.get), and the review of deliveries (projects.reviewTask). Empty columns stay out. */
export default function Project() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bottom = useTabBarSpace();
  const queryClient = useQueryClient();
  const project = useQuery({ queryKey: ["project", id], queryFn: () => api.projects.get({ id }) });
  const loading = useDelayed(project.isPending);
  const [reviewing, setReviewing] = useState<Task | null>(null);
  const [reviewed, setReviewed] = useState<string | null>(null);
  const p = project.data;
  const canReview = !!p?.canReview;
  const columns = p?.columns.filter((column) => column.tasks.length > 0) ?? [];
  // Waiting on the viewer: deliveries with a test deadline, and every one in Revisão when they approve.
  const review = columns.flatMap((column) =>
    column.tasks
      .filter((task) => task.reviewDue || (canReview && column.status === "review"))
      .map((task) => ({ task, status: column.status })),
  );
  const open = (task: Task) => {
    haptic.light();
    setReviewed(null);
    setReviewing(task);
  };
  const done = async (message: string) => {
    setReviewed(message);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["project", id] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["overview"] }),
    ]);
  };
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.gutter, gap: space.block, paddingBottom: bottom }}
      scrollIndicatorInsets={{ bottom }}
      refreshControl={<RefreshControl refreshing={project.isRefetching} onRefresh={() => void project.refetch()} />}
    >
      {loading ? (
        <>
          <SkeletonHeader />
          <SkeletonRows count={3} inset={0} />
        </>
      ) : null}
      {project.error ? <Notice kind="error">{errorMessage(project.error)}</Notice> : null}
      {p ? (
        <>
          <View style={{ gap: space.sm }}>
            <Pill label={p.statusLabel} tone="info" />
            <Text variant="title" accessibilityRole="header">
              {p.name}
            </Text>
            <Text variant="subhead" tone="muted">
              {p.company}
            </Text>
            {p.description?.trim() ? (
              <Text variant="subhead" tone="muted">
                {p.description.trim()}
              </Text>
            ) : null}
          </View>
          <Progress columns={p.columns} />
          {reviewed ? <Notice kind="success">{reviewed}</Notice> : null}
          {review.length > 0 ? (
            <Section header="Aguardando sua revisão" indent={TASK_INDENT}>
              {review.map(({ task, status }) =>
                canReview && status === "review" ? (
                  <View key={task.id}>
                    <TaskRow task={task} status={status} />
                    <View style={{ paddingLeft: TASK_INDENT, paddingRight: space.lg, paddingBottom: space.md }}>
                      <Button
                        testID="review-task"
                        title="Revisar"
                        size="small"
                        icon="checklist"
                        accessibilityLabel={`Revisar ${task.title}`}
                        onPress={() => open(task)}
                      />
                    </View>
                  </View>
                ) : (
                  <TaskRow key={task.id} task={task} status={status} />
                ),
              )}
            </Section>
          ) : null}
          {columns.map((column) => (
            <Section key={column.status} header={`${column.label} · ${column.tasks.length}`} indent={TASK_INDENT}>
              {column.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  status={column.status}
                  onPress={canReview && column.status === "review" ? () => open(task) : undefined}
                />
              ))}
            </Section>
          ))}
          {columns.length === 0 ? (
            <EmptyState
              icon="square.dashed"
              title="Nenhuma tarefa ainda"
              text="As tarefas aparecem aqui quando a equipe montar o quadro."
            />
          ) : null}
          <ReviewSheet task={reviewing} onClose={() => setReviewing(null)} onDone={done} />
        </>
      ) : null}
    </ScrollView>
  );
}
