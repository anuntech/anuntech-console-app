import { useDeferredValue, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { SymbolView, type SFSymbol } from "@/components/symbol";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { Chip } from "@/components/chip";
import { EmptyState } from "@/components/empty-state";
import { ListRow } from "@/components/list-row";
import { PickSheet, type PickOption } from "@/components/pick-sheet";
import { Pill } from "@/components/pill";
import { Section } from "@/components/section";
import { Sheet } from "@/components/sheet";
import { SkeletonHeader, SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { TaskReviewSheet, type ReviewTarget } from "@/components/task-review-sheet";
import { Text } from "@/components/text";
import { IconTile } from "@/components/tile";
import { api, errorMessage } from "@/lib/api";
import { civilDate, when } from "@/lib/format";
import { clearFlash, useFlash } from "@/lib/flash";
import { haptic } from "@/lib/haptics";
import { openHelp } from "@/lib/help-link";
import { useTabBarSpace } from "@/lib/layout";
import { HeaderIconButton } from "@/lib/stack";
import type { ToneName } from "@/lib/status";
import { estimateLabel, fold } from "@/lib/tasks";
import { fonts, rounded, space, usePalette, type Palette } from "@/lib/theme";

/** Hairlines start where the task title does: 16 padding, a 24 symbol, 12 gap. */
const TASK_INDENT = 52;
/** The "Sem responsável" choice of the people filter (never a real id). */
const NOBODY = "__nobody__";

type Board = Awaited<ReturnType<typeof api.projects.get>>;
type Task = Board["columns"][number]["tasks"][number];
type Filters = { people: string[]; labels: string[]; priorities: string[] };
const noFilters: Filters = { people: [], labels: [], priorities: [] };
const projectTones: Record<string, ToneName> = { paused: "attention", completed: "good", suspended: "danger" };

/** Each column's symbol and color: open circles still to do, a half circle in progress, a check when done. */
function columnLook(palette: Palette, status: string): { icon: SFSymbol; color: string; bar: string } {
  if (status === "in_progress") return { icon: "circle.lefthalf.filled", color: palette.primary, bar: palette.primary };
  if (status === "review") return { icon: "eye.circle.fill", color: palette.warning, bar: palette.warning };
  if (status === "done") return { icon: "checkmark.circle.fill", color: palette.success, bar: palette.success };
  return { icon: "circle", color: palette.tertiary, bar: palette.fill };
}

/** Within a filter any choice matches; across filters all must match (the web's board). */
function matches(task: Task, filters: Filters, search: string) {
  if (
    filters.people.length &&
    !filters.people.some((id) => (id === NOBODY ? task.assigneeIds.length === 0 : task.assigneeIds.includes(id)))
  )
    return false;
  if (filters.labels.length && !filters.labels.some((label) => task.labels.includes(label))) return false;
  if (filters.priorities.length && !filters.priorities.includes(task.priority)) return false;
  const query = fold(search);
  if (!query) return true;
  const haystack = fold([task.title, task.description ?? "", ...task.labels, ...task.assignees].join(" "));
  return query.split(/\s+/).every((word) => haystack.includes(word));
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

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * One task as a row, like the web's card: the request mark, labels, a
 * priority above normal, the deadline (late in red), estimate, files,
 * comments and who has it.
 */
function TaskRow({ task, onPress }: { task: Task; onPress: () => void }) {
  const palette = usePalette();
  const look = columnLook(palette, task.status);
  const done = task.status === "done";
  const urgent = !done && (task.priority === "high" || task.priority === "urgent");
  const shown = task.labels.slice(0, 3);
  const details = [
    urgent ? `Prioridade ${task.priorityLabel.toLowerCase()}` : null,
    task.estimateLabel ? `Estimativa ${task.estimateLabel}` : null,
    task.files ? plural(task.files, "anexo", "anexos") : null,
    task.comments ? plural(task.comments, "comentário", "comentários") : null,
    task.assignees.length ? task.assignees.join(", ") : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const due =
    task.dueDate && !done
      ? task.overdue
        ? `Atrasada · prazo ${civilDate(task.dueDate)}`
        : task.dueToday
          ? "Prazo hoje"
          : `Prazo ${civilDate(task.dueDate)}`
      : null;
  const review = task.reviewDue ? `Teste até ${when(task.reviewDue)}` : null;
  const marks = task.requested || shown.length > 0;
  return (
    <ListRow
      leading={<SymbolView name={look.icon} size={20} tintColor={look.color} accessible={false} style={{ width: 24, height: 24 }} />}
      title={
        <Text tone={done ? "muted" : "foreground"} numberOfLines={3} style={{ fontFamily: fonts.semibold }}>
          {task.title}
        </Text>
      }
      subtitle={
        marks ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4, marginTop: 4 }}>
            {task.requested ? <Pill label="Pedido do cliente" tone="attention" /> : null}
            {shown.map((label) => (
              <Pill key={label} label={label} tone="neutral" />
            ))}
            {task.labels.length > shown.length ? (
              <Text variant="caption" tone="muted">
                +{task.labels.length - shown.length}
              </Text>
            ) : null}
          </View>
        ) : undefined
      }
      meta={
        details || due || review ? (
          <View style={{ gap: 2, marginTop: 2 }}>
            {due ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <SymbolView
                  name="calendar"
                  size={12}
                  tintColor={task.overdue ? palette.destructive : task.dueToday ? palette.warning : palette.muted}
                  accessible={false}
                />
                <Text
                  variant="caption"
                  tone={task.overdue ? "destructive" : task.dueToday ? "warning" : "muted"}
                  style={task.overdue || task.dueToday ? { fontFamily: fonts.semibold } : undefined}
                >
                  {due}
                </Text>
              </View>
            ) : null}
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
      accessibilityLabel={[task.title, task.requested ? "Pedido do cliente" : null, task.labels.join(", "), due, details, review]
        .filter(Boolean)
        .join(", ")}
      accessibilityHint="Abre a tarefa"
      onPress={onPress}
    />
  );
}

/** "Sobre este projeto": the objective and how the board works with the team (the web's ProjectAbout). */
function AboutSheet({ board, visible, onClose }: { board: Board; visible: boolean; onClose: () => void }) {
  const palette = usePalette();
  return (
    <Sheet visible={visible} onClose={onClose} title="Sobre este projeto" subtitle={board.name}>
      {/* No objective written yet: the section is left out, not filled with a placeholder. */}
      {board.description?.trim() ? (
        <View style={{ gap: space.sm }}>
          <Text variant="label" accessibilityRole="header">
            Objetivo
          </Text>
          <Text selectable>{board.description.trim()}</Text>
        </View>
      ) : null}
      <View style={{ gap: space.sm }}>
        <Text variant="label" accessibilityRole="header">
          Como usar o quadro
        </Text>
        {board.guide.map((rule) => (
          <View key={rule} style={{ flexDirection: "row", gap: space.sm }}>
            <View accessible={false} style={{ width: 5, height: 5, borderRadius: 3, marginTop: 10, backgroundColor: palette.muted }} />
            <Text style={{ flex: 1 }}>{rule}</Text>
          </View>
        ))}
      </View>
      <Button
        title="Como funciona o quadro"
        variant="plain"
        icon="questionmark.circle"
        onPress={() => {
          onClose();
          openHelp("quadro-do-projeto");
        }}
      />
    </Sheet>
  );
}

/**
 * One project's board (projects.get): the columns with their tasks, search
 * and filters, what waits for the viewer's review, the project's about and
 * activity, and a new task or request. Every task opens its detail.
 */
export default function Project() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const palette = usePalette();
  const bottom = useTabBarSpace();
  const queryClient = useQueryClient();
  const project = useQuery({ queryKey: ["project", id], queryFn: () => api.projects.get({ id }) });
  const loading = useDelayed(project.isPending);
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.trim());
  const [filters, setFilters] = useState<Filters>(noFilters);
  // The sheet keeps its list while it slides out after closing.
  const [pick, setPick] = useState<keyof Filters>("people");
  const [picking, setPicking] = useState(false);
  const [about, setAbout] = useState(false);
  const [reviewing, setReviewing] = useState<ReviewTarget | null>(null);
  const [reviewed, setReviewed] = useState<string | null>(null);
  // A task deleted from its detail says so here, while the board is open.
  const flash = useFlash();
  useEffect(() => () => clearFlash(), []);
  const p = project.data;
  const canReview = !!p?.canReview;
  const narrowed = filters.people.length > 0 || filters.labels.length > 0 || filters.priorities.length > 0;
  const filtering = !!query || narrowed;
  const columns = (p?.columns ?? [])
    .map((column) => ({ ...column, tasks: column.tasks.filter((task) => !filtering || matches(task, filters, query)) }))
    .filter((column) => column.tasks.length > 0);
  const total = p?.columns.reduce((sum, column) => sum + column.tasks.length, 0) ?? 0;
  // Waiting on the viewer: deliveries with a test deadline, and every one in Revisão when they approve.
  const review = (p?.columns ?? []).flatMap((column) =>
    column.tasks.filter((task) => task.reviewDue || (canReview && column.status === "review")),
  );
  const labels = [...new Set(p?.columns.flatMap((column) => column.tasks.flatMap((task) => task.labels)) ?? [])].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  const options: Record<keyof Filters, { title: string; options: PickOption[] }> = {
    people: {
      title: "Pessoas",
      options: [
        { value: NOBODY, label: "Sem responsável", leading: <IconTile icon="person.crop.circle.badge.questionmark" color="gray" /> },
        ...(p?.people ?? []).map((person) => ({
          value: person.id,
          label: person.id === p?.viewer.id ? `${person.name} (você)` : person.name,
          leading: <Avatar avatar={person.avatar} name={person.name} size={32} />,
        })),
      ],
    },
    labels: { title: "Etiquetas", options: labels.map((label) => ({ value: label, label })) },
    priorities: { title: "Prioridade", options: p?.priorities ?? [] },
  };
  const create = () => {
    haptic.light();
    clearFlash();
    router.push({ pathname: "/projetos/tarefa/nova", params: { projeto: id } });
  };
  const openTask = (task: Task) => {
    haptic.light();
    clearFlash();
    router.push({ pathname: "/projetos/tarefa/[id]", params: { id: task.id } });
  };
  const done = async (message: string) => {
    setReviewed(message);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["project", id] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["task"] }),
      queryClient.invalidateQueries({ queryKey: ["overview"] }),
    ]);
  };
  const chip = (key: keyof Filters) => {
    const count = filters[key].length;
    return (
      <Chip
        key={key}
        label={count ? `${options[key].title} · ${count}` : options[key].title}
        group="Filtrar tarefas"
        selected={count > 0}
        onPress={() => {
          setPick(key);
          setPicking(true);
        }}
      />
    );
  };
  return (
    <>
      <Stack.Screen
        options={{
          headerRight: p?.canCreate
            ? () => <HeaderIconButton symbol="plus" label="Nova tarefa" tint="primary" testID="new-task" onPress={create} />
            : undefined,
          headerSearchBarOptions: {
            placeholder: "Buscar tarefas",
            hideWhenScrolling: true,
            onChangeText: (e) => setSearch(e.nativeEvent.text),
          },
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        style={{ backgroundColor: palette.background }}
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
              {projectTones[p.status] ? <Pill label={p.statusLabel} tone={projectTones[p.status]} /> : null}
              <Text variant="title" accessibilityRole="header">
                {p.name}
              </Text>
              {/* Whose board it is, only for who sees more than one company (older servers send no showCompany). */}
              {p.showCompany !== false ? (
                <Text variant="subhead" tone="muted">
                  {p.company}
                </Text>
              ) : null}
            </View>
            <Progress columns={p.columns} />
            <Section indent={60}>
              <ListRow
                leading={<IconTile icon="info.circle.fill" color="violet" />}
                title="Sobre este projeto"
                subtitle={p.description?.trim() || undefined}
                testID="project-about"
                onPress={() => setAbout(true)}
              />
              <ListRow
                leading={<IconTile icon="clock.arrow.circlepath" color="gray" />}
                title="Atividade do projeto"
                testID="project-activity"
                onPress={() => router.push({ pathname: "/projetos/atividade", params: { id } })}
              />
            </Section>
            {flash ? <Notice kind="success">{flash.text}</Notice> : null}
            {reviewed ? <Notice kind="success">{reviewed}</Notice> : null}
            {review.length > 0 && !filtering ? (
              <Section header="Aguardando sua revisão" indent={TASK_INDENT}>
                {review.map((task) =>
                  canReview && task.status === "review" ? (
                    <View key={task.id}>
                      <TaskRow task={task} onPress={() => openTask(task)} />
                      <View style={{ paddingLeft: TASK_INDENT, paddingRight: space.lg, paddingBottom: space.md }}>
                        <Button
                          testID="review-task"
                          title="Revisar"
                          size="small"
                          icon="checklist"
                          accessibilityLabel={`Revisar ${task.title}`}
                          onPress={() => {
                            haptic.light();
                            setReviewed(null);
                            setReviewing(task);
                          }}
                        />
                      </View>
                    </View>
                  ) : (
                    <TaskRow key={task.id} task={task} onPress={() => openTask(task)} />
                  ),
                )}
              </Section>
            ) : null}
            {total > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -space.gutter }}
                contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.gutter, paddingVertical: 4 }}
              >
                {chip("people")}
                {labels.length > 0 ? chip("labels") : null}
                {chip("priorities")}
                {narrowed ? (
                  <Chip label="Limpar" group="Filtrar tarefas" selected={false} onPress={() => setFilters(noFilters)} />
                ) : null}
              </ScrollView>
            ) : null}
            {columns.map((column) => {
              const minutes = column.tasks.reduce((sum, task) => sum + (task.estimateMinutes ?? 0), 0);
              return (
                <Section
                  key={column.status}
                  header={[column.label, String(column.tasks.length), minutes ? estimateLabel(minutes) : null].filter(Boolean).join(" · ")}
                  indent={TASK_INDENT}
                >
                  {column.tasks.map((task) => (
                    <TaskRow key={task.id} task={task} onPress={() => openTask(task)} />
                  ))}
                </Section>
              );
            })}
            {total === 0 ? (
              <EmptyState
                icon="square.dashed"
                title="Nenhuma tarefa ainda"
                text="As tarefas aparecem aqui quando a equipe montar o quadro. Precisa de algo? Faça um pedido."
                action={p.canCreate ? { label: "Nova tarefa", icon: "plus", onPress: create } : undefined}
              />
            ) : columns.length === 0 ? (
              <EmptyState
                icon="line.3.horizontal.decrease.circle"
                title="Nada com esses filtros"
                text="Troque a busca ou os filtros para ver outras tarefas."
                action={narrowed ? { label: "Limpar filtros", onPress: () => setFilters(noFilters) } : undefined}
              />
            ) : null}
            <AboutSheet board={p} visible={about} onClose={() => setAbout(false)} />
            <PickSheet
              visible={picking}
              multiple
              title={options[pick].title}
              options={options[pick].options}
              selected={filters[pick]}
              onChange={(values) => setFilters({ ...filters, [pick]: values })}
              onClose={() => setPicking(false)}
            />
            <TaskReviewSheet task={reviewing} onClose={() => setReviewing(null)} onDone={done} />
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
