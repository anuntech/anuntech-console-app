"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Building2Icon,
  CalendarIcon,
  CircleCheckIcon,
  Clock3Icon,
  GripVerticalIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  MessageSquareIcon,
  PaperclipIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UserRoundIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/console/multi-select";
import { useFillViewport } from "@/components/console/fill-viewport";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/console/page-header";
import { toast } from "@/components/shell/notifications";
import { moveTask } from "@/lib/projects/task-actions";
import { dueLabel, shortDateLabel } from "@/lib/format";
import { canDeleteEngagement, type EngagementLinks } from "@/lib/deletion-rules";
import { AvatarStack, PersonAvatar } from "@/components/console/person-avatar";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  estimateLabel,
  taskPriorityLabels,
  taskStatusLabels,
  type TaskStatus,
} from "@/lib/projects/task-model";
import {
  EngagementStatusBadge,
  LabelChip,
  PriorityDot,
  TaskPriorityMark,
  labelDot,
} from "./project-badges";
import { useEngagementStatus } from "./engagement-status";
import { ProjectSheet } from "./project-form";
import { ProjectAbout } from "./project-about";
import { ProjectActivity } from "./project-activity";
import type { ActivityEvent } from "@/lib/projects/activity-model";
import { TaskReviewDialog } from "./task-review-dialog";
import { DeleteEngagementDialog } from "./delete-engagement-dialog";
import { TaskSheet, type BoardPerson, type BoardTask, type TaskEditor } from "./task-sheet";

export type ProjectBoardData = {
  project: {
    id: string;
    name: string;
    kind: "product" | "project";
    status: string;
    description: string | null;
    companyId: string;
    company: string;
    /** Staff only: what points at it, so "Excluir" shows only when it can go. */
    links?: EngagementLinks;
  };
  tasks: BoardTask[];
  people: BoardPerson[];
  viewer: { id: string; admin: boolean; approver?: boolean };
  today: string;
  now: string;
  /** "Atividade": the board's history, newest first (lib/projects/project-activity.ts). */
  activity?: ActivityEvent[];
};

type Columns = Record<TaskStatus, string[]>;

const columnDots: Record<TaskStatus, string> = {
  backlog: "bg-muted-foreground/40",
  todo: "bg-primary/60",
  in_progress: "bg-primary",
  review: "bg-warning",
  done: "bg-success",
};

function group(tasks: BoardTask[]): Columns {
  const columns: Columns = { backlog: [], todo: [], in_progress: [], review: [], done: [] };
  for (const task of tasks) columns[task.status].push(task.id);
  return columns;
}
const isColumn = (id: UniqueIdentifier): id is TaskStatus =>
  TASK_STATUSES.includes(id as TaskStatus);
const columnOf = (columns: Columns, id: UniqueIdentifier) =>
  TASK_STATUSES.find((status) => columns[status].includes(String(id)));

/** Accent- and case-insensitive text for search. */
const fold = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
const NOBODY = "none";
type Filters = { search: string; people: string[]; labels: string[]; priorities: string[] };
const noFilters: Filters = { search: "", people: [], labels: [], priorities: [] };

/** Within a filter any choice matches; across filters all must match. */
function matches(task: BoardTask, filters: Filters) {
  if (
    filters.people.length &&
    !filters.people.some((id) =>
      id === NOBODY ? task.assignees.length === 0 : task.assignees.some((p) => p.id === id),
    )
  )
    return false;
  if (filters.labels.length && !filters.labels.some((label) => task.labels.includes(label)))
    return false;
  if (filters.priorities.length && !filters.priorities.includes(task.priority)) return false;
  const query = fold(filters.search.trim());
  if (!query) return true;
  const haystack = fold(
    [task.title, task.description ?? "", ...task.labels, ...task.assignees.map((p) => p.name)].join(" "),
  );
  return query.split(/\s+/).every((word) => haystack.includes(word));
}

function dueTone(due: string, today: string, done: boolean) {
  if (done) return "text-muted-foreground";
  if (due < today) return "text-destructive";
  if (due === today) return "text-warning";
  return "text-muted-foreground";
}

/** The card as drawn in a column and in the drag overlay. */
function TaskCard({
  onReview,
  now,
  task,
  done,
  today,
  onOpen,
  handle,
  dragging = false,
}: {
  task: BoardTask;
  done: boolean;
  today: string;
  onOpen?: () => void;
  handle?: ReactNode;
  dragging?: boolean;
  /** Opens the client's review of a delivery in Revisão. */
  onReview?: () => void;
  now?: string;
}) {
  const meta =
    task.priority !== "normal" ||
    task.dueDate ||
    task.assignees.length > 0 ||
    task.estimateMinutes != null ||
    task.files.length > 0 ||
    task.comments.length > 0;
  const shownLabels = task.labels.slice(0, 3);
  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card shadow-card transition-[border-color,box-shadow] hover:border-primary/40",
        dragging && "rotate-[1.5deg] border-primary/40 shadow-float",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full flex-col gap-2.5 rounded-lg p-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span
          className={cn(
            "line-clamp-3 pr-5 text-sm leading-5 font-medium",
            done ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {task.title}
        </span>
        {task.requested && (
          <span className="inline-flex w-fit items-center rounded-md bg-warning-soft px-1.5 py-px text-[11px] font-medium text-warning">
            Pedido do cliente
          </span>
        )}
        {shownLabels.length > 0 && (
          <span className="flex w-full flex-wrap items-center gap-1">
            {shownLabels.map((label) => (
              <LabelChip key={label} label={label} />
            ))}
            {task.labels.length > shownLabels.length && (
              <span className="text-[11px] text-muted-foreground">
                +{task.labels.length - shownLabels.length}
              </span>
            )}
          </span>
        )}
        {meta && (
          <span className="flex w-full flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            {task.priority !== "normal" && <TaskPriorityMark priority={task.priority} />}
            {task.dueDate && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 tabular-nums",
                  dueTone(task.dueDate, today, done),
                )}
                title={`Prazo ${shortDateLabel(task.dueDate)}`}
              >
                <CalendarIcon className="size-3" />
                {shortDateLabel(task.dueDate)}
              </span>
            )}
            {task.estimateMinutes != null && (
              <span className="inline-flex items-center gap-1 tabular-nums" title="Estimativa">
                <Clock3Icon className="size-3" />
                {estimateLabel(task.estimateMinutes)}
              </span>
            )}
            {task.files.length > 0 && (
              <span
                className="inline-flex items-center gap-1 tabular-nums"
                title={`${task.files.length} ${task.files.length === 1 ? "anexo" : "anexos"}`}
              >
                <PaperclipIcon className="size-3" />
                {task.files.length}
              </span>
            )}
            {task.comments.length > 0 && (
              <span
                className="inline-flex items-center gap-1 tabular-nums"
                title={`${task.comments.length} ${task.comments.length === 1 ? "comentário" : "comentários"}`}
              >
                <MessageSquareIcon className="size-3" />
                {task.comments.length}
              </span>
            )}
            {task.assignees.length > 0 && (
              <AvatarStack people={task.assignees} size={24} className="ml-auto" />
            )}
          </span>
        )}
      </button>
      {task.status === "review" && (task.reviewDue || onReview) && (
        <div className="flex items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
          <span className="min-w-0 flex-1 truncate">
            {task.reviewDue && now ? `Teste até ${dueLabel(task.reviewDue, now)}` : "Pronta para testar"}
          </span>
          {onReview && (
            <Button type="button" size="sm" className="h-7 px-2.5 text-xs" onClick={onReview}>
              Revisar
            </Button>
          )}
        </div>
      )}
      {handle}
    </div>
  );
}

function SortableCard({
  task,
  status,
  today,
  onOpen,
  onReview,
  now,
}: {
  task: BoardTask;
  status: TaskStatus;
  today: string;
  onOpen: (task: BoardTask) => void;
  onReview?: (task: BoardTask) => void;
  now: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: "task" } });
  // The whole card drags with the pointer; the keyboard picks it up by the grip.
  const { onKeyDown, ...pointer } = (listeners ?? {}) as Record<string, unknown> & {
    onKeyDown?: React.KeyboardEventHandler;
  };
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("touch-none", isDragging && "opacity-40")}
      {...pointer}
    >
      <TaskCard
        task={task}
        done={status === "done"}
        today={today}
        onOpen={() => onOpen(task)}
        onReview={onReview && status === "review" ? () => onReview(task) : undefined}
        now={now}
        handle={
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            onKeyDown={onKeyDown}
            aria-label={`Mover: ${task.title}`}
            className="absolute top-2 right-1.5 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <GripVerticalIcon className="size-3.5" />
          </button>
        }
      />
    </li>
  );
}

function Column({
  status,
  ids,
  tasks,
  today,
  filtered,
  onOpen,
  onAdd,
  onReview,
  now,
}: {
  status: TaskStatus;
  ids: string[];
  tasks: Map<string, BoardTask>;
  today: string;
  filtered: boolean;
  onOpen: (task: BoardTask) => void;
  onAdd: (status: TaskStatus) => void;
  onReview?: (task: BoardTask) => void;
  now: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { type: "column" } });
  const label = taskStatusLabels[status];
  const estimate = ids.reduce((sum, id) => sum + (tasks.get(id)?.estimateMinutes ?? 0), 0);
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`column-${status}`}
      className={cn(
        "flex min-h-0 min-w-[248px] flex-1 basis-[248px] snap-start flex-col rounded-xl bg-secondary/70 transition-colors",
        isOver && "bg-accent",
      )}
    >
      <header className="flex h-11 items-center gap-2 px-3 pt-1">
        <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", columnDots[status])} />
        <h2
          id={`column-${status}`}
          className="m-0 truncate text-sm leading-5 font-medium text-foreground"
        >
          {label}
        </h2>
        <span className="rounded-full bg-background/80 px-1.5 text-xs leading-5 tabular-nums text-muted-foreground">
          {ids.length}
        </span>
        {estimate > 0 && (
          <span
            className="inline-flex items-center gap-1 text-xs leading-5 tabular-nums text-muted-foreground"
            title="Soma das estimativas"
          >
            <Clock3Icon className="size-3" />
            {estimateLabel(estimate)}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={`Nova tarefa em ${label}`}
          onClick={() => onAdd(status)}
        >
          <PlusIcon />
        </Button>
      </header>
      <SortableContext id={status} items={ids} strategy={verticalListSortingStrategy}>
        <ol className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-2 pb-2 [scrollbar-width:thin]">
          {ids.map((id) => {
            const task = tasks.get(id);
            return task ? (
              <SortableCard key={id} task={task} status={status} today={today} onOpen={onOpen} onReview={onReview} now={now} />
            ) : null;
          })}
          {ids.length === 0 && (
            <li className="flex min-h-20 flex-1 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
              {isOver ? "Solte aqui" : filtered ? "Nada com esses filtros" : "Sem tarefas"}
            </li>
          )}
        </ol>
      </SortableContext>
    </section>
  );
}

/** Columns never get shorter than this; below it the page scrolls instead. */
const BOARD_MIN_HEIGHT = 360;

export function ProjectBoard({ data }: { data: ProjectBoardData }) {
  const { project, tasks, people, viewer, today, now, activity = [] } = data;
  const boardRef = useRef<HTMLDivElement>(null);
  // The board fills the screen down to the dock, so the page never grows with
  // the tasks: each column scrolls on its own.
  const boardFit = useFillViewport(boardRef, { min: BOARD_MIN_HEIGHT });
  const router = useRouter();
  const byId = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const [columns, setColumnsState] = useState<Columns>(() => group(tasks));
  // Drag events read the latest columns synchronously, before React re-renders.
  const columnsRef = useRef(columns);
  const setColumns = useCallback((next: Columns | ((current: Columns) => Columns)) => {
    const value = typeof next === "function" ? next(columnsRef.current) : next;
    columnsRef.current = value;
    setColumnsState(value);
  }, []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const snapshot = useRef<Columns>(columns);
  const origin = useRef<{ status: TaskStatus; afterId: string | null } | null>(null);
  const lastOver = useRef<UniqueIdentifier | null>(null);
  const [saving, startSaving] = useTransition();
  const [editor, setEditor] = useState<TaskEditor | null>(null);
  const [reviewing, setReviewing] = useState<BoardTask | null>(null);
  const [editingProject, setEditingProject] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const deletable = viewer.admin && canDeleteEngagement(project.links);
  const [filters, setFilters] = useState<Filters>(noFilters);
  const filtering =
    filters.search.trim() !== "" ||
    filters.people.length > 0 ||
    filters.labels.length > 0 ||
    filters.priorities.length > 0;
  const visible = useCallback(
    (id: string) => {
      const task = byId.get(id);
      return !!task && (!filtering || matches(task, filters));
    },
    [byId, filtering, filters],
  );
  const { change, form: statusForm } = useEngagementStatus();
  const changeStatus = (status: "active" | "paused" | "completed") => change(project.id, status, project.name);
  // dnd-kit numbers its aria ids globally; a fixed id keeps server and client in step.
  const dndId = useId();

  // The server is the source of truth once a change lands; never mid-drag.
  useEffect(() => {
    if (!activeRef.current) setColumns(group(tasks));
  }, [tasks, setColumns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Pointer first; inside a column, the nearest card; an empty column itself.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointer = pointerWithin(args);
    const collisions = pointer.length ? pointer : rectIntersection(args);
    let overId = getFirstCollision(collisions, "id");
    if (overId != null) {
      if (isColumn(overId)) {
        const ids = columnsRef.current[overId];
        const cards = args.droppableContainers.filter((c) => ids.includes(String(c.id)));
        if (cards.length)
          overId = closestCenter({ ...args, droppableContainers: cards })[0]?.id ?? overId;
      }
      lastOver.current = overId;
      return [{ id: overId }];
    }
    return lastOver.current ? [{ id: lastOver.current }] : [];
  }, []);

  function onDragStart({ active }: DragStartEvent) {
    const id = String(active.id);
    const status = columnOf(columnsRef.current, id);
    if (!status) return;
    const index = columnsRef.current[status].indexOf(id);
    snapshot.current = columnsRef.current;
    origin.current = { status, afterId: index > 0 ? columnsRef.current[status][index - 1] : null };
    activeRef.current = id;
    setActiveId(id);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const id = String(active.id);
    const from = columnOf(columnsRef.current, id);
    const to = isColumn(over.id) ? over.id : columnOf(columnsRef.current, over.id);
    if (!from || !to || from === to) return;
    setColumns((current) => {
      const source = current[from].filter((item) => item !== id);
      const target = [...current[to]];
      let index = target.length;
      if (!isColumn(over.id)) {
        const overIndex = target.indexOf(String(over.id));
        const translated = active.rect.current.translated;
        const below = translated ? translated.top > over.rect.top + over.rect.height / 2 : false;
        index = overIndex >= 0 ? overIndex + (below ? 1 : 0) : target.length;
      }
      target.splice(index, 0, id);
      return { ...current, [from]: source, [to]: target };
    });
  }

  function finish() {
    activeRef.current = null;
    setActiveId(null);
    lastOver.current = null;
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const id = String(active.id);
    finish();
    const current = columnsRef.current;
    const to = over ? (isColumn(over.id) ? over.id : columnOf(current, over.id)) : undefined;
    if (!over || !to) return setColumns(snapshot.current);
    const items = current[to].includes(id) ? current[to] : [...current[to], id];
    const fromIndex = items.indexOf(id);
    const overIndex = isColumn(over.id) ? items.length - 1 : items.indexOf(String(over.id));
    const next = overIndex >= 0 && overIndex !== fromIndex ? arrayMove(items, fromIndex, overIndex) : items;
    const from = columnOf(current, id);
    const updated: Columns = {
      ...current,
      ...(from && from !== to ? { [from]: current[from].filter((item) => item !== id) } : {}),
      [to]: next,
    };
    setColumns(updated);
    const index = next.indexOf(id);
    const afterId = index > 0 ? next[index - 1] : null;
    if (origin.current?.status === to && origin.current.afterId === afterId) return;
    const revert = snapshot.current;
    startSaving(async () => {
      const state = await moveTask({ id, status: to, afterId });
      if (state.error) {
        toast.error(state.error);
        setColumns(revert);
      } else router.refresh();
    });
  }

  function onDragCancel() {
    finish();
    setColumns(snapshot.current);
  }

  const activeTask = activeId ? byId.get(activeId) : undefined;
  // After a refresh the open sheet shows the task as the server now has it.
  const currentEditor: TaskEditor | null =
    editor?.mode === "edit"
      ? { mode: "edit", task: byId.get(editor.task.id) ?? editor.task }
      : editor;
  const labelSuggestions = [...new Set(tasks.flatMap((task) => task.labels))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  const titleOf = (id: UniqueIdentifier) => byId.get(String(id))?.title ?? "tarefa";
  const placeOf = (id: UniqueIdentifier) =>
    isColumn(id)
      ? taskStatusLabels[id]
      : `${taskStatusLabels[columnOf(columnsRef.current, id) ?? "todo"]}, perto de ${titleOf(id)}`;
  return (
    <>
      {/* Small screens are most of the clients: the heading is only the path and
          the name, and the actions share the line with the filters. */}
      <PageHeader
        className="mb-4"
        crumbs={[{ label: "Projetos", href: "/projetos" }, { label: project.name }]}
        title={
          <>
            {project.name}
            {/* Active is the normal state; only a paused or finished project says so. */}
            {project.status !== "active" && (
              <EngagementStatusBadge status={project.status} className="ml-2.5 align-middle" />
            )}
          </>
        }
      />

      {/* Arrival: the header rises, the filters follow a beat later, the columns
          settle left to right (once; filtering only re-renders them). */}
      <div className="reveal mb-4 flex flex-wrap items-center gap-2 [--i:1]">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
            placeholder="Buscar tarefas"
            aria-label="Buscar tarefas"
            className="bg-card pl-9"
          />
        </div>
        <MultiSelect
          label="Pessoas"
          searchPlaceholder="Buscar pessoa"
          selected={filters.people}
          onChange={(people) => setFilters({ ...filters, people })}
          options={[
            {
              value: NOBODY,
              label: "Sem responsável",
              icon: (
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-input text-muted-foreground">
                  <UserRoundIcon className="size-3" />
                </span>
              ),
            },
            ...people.map((person) => ({
              value: person.id,
              label: person.name,
              icon: <PersonAvatar person={person} size={24} />,
            })),
          ]}
        />
        {labelSuggestions.length > 0 && (
          <MultiSelect
            label="Etiquetas"
            searchPlaceholder="Buscar etiqueta"
            selected={filters.labels}
            onChange={(labels) => setFilters({ ...filters, labels })}
            options={labelSuggestions.map((label) => ({
              value: label,
              label,
              icon: (
                <span
                  aria-hidden="true"
                  className={cn("size-2.5 shrink-0 rounded-full", labelDot(label))}
                />
              ),
            }))}
          />
        )}
        <MultiSelect
          label="Prioridade"
          selected={filters.priorities}
          onChange={(priorities) => setFilters({ ...filters, priorities })}
          options={TASK_PRIORITIES.map((priority) => ({
            value: priority,
            label: taskPriorityLabels[priority],
            icon: <PriorityDot priority={priority} />,
          }))}
        />
        {filtering && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(noFilters)}>
            <XIcon />
            Limpar
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {saving && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2Icon className="size-3 animate-spin" />
              Salvando…
            </span>
          )}
          <ProjectActivity
            name={project.name}
            events={activity}
            today={today}
            onOpenTask={(taskId) => {
              const task = byId.get(taskId);
              if (task) setEditor({ mode: "edit", task });
            }}
          />
          <ProjectAbout name={project.name} description={project.description} />
          <Button onClick={() => setEditor({ mode: "create", status: "todo" })}>
            <PlusIcon />
            Nova tarefa
          </Button>
          {viewer.admin && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Mais ações">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem onSelect={() => setTimeout(() => setEditingProject(true), 0)}>
                  <PencilIcon />
                  Editar projeto
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/empresas/${project.companyId}`}>
                    <Building2Icon />
                    Ver empresa
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {project.status !== "active" && (
                  <DropdownMenuItem onSelect={() => changeStatus("active")}>
                    <PlayIcon />
                    {project.status === "paused" ? "Retomar" : "Reabrir"}
                  </DropdownMenuItem>
                )}
                {project.status === "active" && (
                  <DropdownMenuItem onSelect={() => changeStatus("paused")}>
                    <PauseIcon />
                    Pausar
                  </DropdownMenuItem>
                )}
                {project.status !== "completed" && (
                  <DropdownMenuItem onSelect={() => changeStatus("completed")}>
                    <CircleCheckIcon />
                    Marcar como concluído
                  </DropdownMenuItem>
                )}
                {deletable && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setTimeout(() => setDeletingProject(true), 0)}
                    >
                      <Trash2Icon />
                      Excluir
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Pressione espaço para pegar a tarefa, use as setas para movê-la entre posições e colunas, e espaço de novo para soltar. Esc cancela.",
          },
          announcements: {
            onDragStart: ({ active }) => `Movendo ${titleOf(active.id)}.`,
            onDragOver: ({ active, over }) =>
              over
                ? `${titleOf(active.id)} sobre ${placeOf(over.id)}.`
                : `${titleOf(active.id)} fora do quadro.`,
            onDragEnd: ({ active, over }) =>
              over
                ? `${titleOf(active.id)} solta em ${placeOf(over.id)}.`
                : `Movimento de ${titleOf(active.id)} cancelado.`,
            onDragCancel: ({ active }) => `Movimento de ${titleOf(active.id)} cancelado.`,
          },
        }}
      >
        <div
          ref={boardRef}
          data-fill-viewport=""
          aria-busy={saving || undefined}
          // `stagger` moves the columns, never this box: useFillViewport measures it.
          className="stagger -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2"
          style={{
            height: boardFit?.height ?? `max(${BOARD_MIN_HEIGHT}px, calc(100dvh - 340px))`,
            marginBottom: boardFit?.clearance || undefined,
          }}
        >
          {TASK_STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              ids={columns[status].filter(visible)}
              tasks={byId}
              today={today}
              filtered={filtering}
              onOpen={(task) => setEditor({ mode: "edit", task })}
              onAdd={(column) => setEditor({ mode: "create", status: column })}
              onReview={viewer.approver && !viewer.admin ? setReviewing : undefined}
              now={now}
            />
          ))}
        </div>
        <DragOverlay
          dropAnimation={{
            duration: 220,
            easing: "cubic-bezier(0.2, 0, 0, 1)", // WAAPI cannot read CSS variables; keep in sync with --anu-motion-ease
            sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }),
          }}
        >
          {activeTask && (
            <TaskCard
              task={activeTask}
              done={columnOf(columns, activeTask.id) === "done"}
              today={today}
              dragging
            />
          )}
        </DragOverlay>
      </DndContext>

      <TaskReviewDialog task={reviewing} onClose={() => setReviewing(null)} now={now} />
      <TaskSheet
        editor={currentEditor}
        onClose={() => setEditor(null)}
        projectId={project.id}
        people={people}
        labelSuggestions={labelSuggestions}
        viewer={viewer}
        now={now}
      />
      {viewer.admin && (
        <ProjectSheet
          open={editingProject}
          onOpenChange={setEditingProject}
          values={{ id: project.id, name: project.name, description: project.description }}
          onDelete={deletable ? () => setDeletingProject(true) : undefined}
        />
      )}
      {deletable && (
        <DeleteEngagementDialog
          engagement={{ id: project.id, name: project.name, kind: "project" }}
          tasks={tasks.length}
          open={deletingProject}
          onOpenChange={setDeletingProject}
        />
      )}
      {viewer.admin && statusForm}
    </>
  );
}
