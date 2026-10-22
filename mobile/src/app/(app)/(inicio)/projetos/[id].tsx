import { RefreshControl, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { useQuery } from "@tanstack/react-query";
import { Text } from "@/components/text";
import { Notice } from "@/components/surface";
import { Pill } from "@/components/pill";
import { ListRow } from "@/components/list-row";
import { Section } from "@/components/section";
import { EmptyState } from "@/components/empty-state";
import { SkeletonHeader, SkeletonRows, useDelayed } from "@/components/skeleton";
import { api, errorMessage } from "@/lib/api";
import { civilDate, when } from "@/lib/format";
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
function TaskRow({ task, status }: { task: Task; status: string }) {
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
    />
  );
}

/** One project's board, column by column (projects.get). Empty columns stay out. */
export default function Project() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bottom = useTabBarSpace();
  const project = useQuery({ queryKey: ["project", id], queryFn: () => api.projects.get({ id }) });
  const loading = useDelayed(project.isPending);
  const p = project.data;
  const columns = p?.columns.filter((column) => column.tasks.length > 0) ?? [];
  const review = columns.flatMap((column) => column.tasks.filter((task) => task.reviewDue).map((task) => ({ task, status: column.status })));
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
          {review.length > 0 ? (
            <Section header="Aguardando sua revisão" indent={TASK_INDENT}>
              {review.map(({ task, status }) => (
                <TaskRow key={task.id} task={task} status={status} />
              ))}
            </Section>
          ) : null}
          {columns.map((column) => (
            <Section key={column.status} header={`${column.label} · ${column.tasks.length}`} indent={TASK_INDENT}>
              {column.tasks.map((task) => (
                <TaskRow key={task.id} task={task} status={column.status} />
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
        </>
      ) : null}
    </ScrollView>
  );
}
