import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SkeletonRows, useDelayed } from "@/components/skeleton";
import { Notice } from "@/components/surface";
import { TaskForm, type TaskValues } from "@/components/task-form";
import { api, errorMessage } from "@/lib/api";
import { showFlash } from "@/lib/flash";
import { haptic } from "@/lib/haptics";
import { space } from "@/lib/theme";

/**
 * A new task on a board (projects.createTask). The client's enters the
 * Backlog as a request, which the team confirms; the team picks the column.
 */
export default function NewTask() {
  const { projeto } = useLocalSearchParams<{ projeto: string }>();
  const queryClient = useQueryClient();
  const board = useQuery({ queryKey: ["project", projeto], queryFn: () => api.projects.get({ id: projeto }) });
  const loading = useDelayed(board.isPending);
  const create = useMutation({
    mutationFn: (values: TaskValues) =>
      api.projects.createTask({
        engagementId: projeto,
        title: values.title,
        description: values.description,
        status: values.status as "backlog" | "todo" | "in_progress" | "review" | "done" | undefined,
        priority: values.priority as "low" | "normal" | "high" | "urgent",
        dueDate: values.dueDate,
        estimate: values.estimate,
        labels: values.labels,
        assigneeIds: values.assigneeIds,
        uploadIds: values.uploadIds,
      }),
    onSuccess: async ({ id, message }) => {
      haptic.success();
      showFlash(message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projeto] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["project-activity", projeto] }),
      ]);
      router.replace({ pathname: "/projetos/tarefa/[id]", params: { id } });
    },
    onError: () => haptic.error(),
  });
  const b = board.data;
  if (!b)
    return (
      <View style={{ paddingTop: space.xl, paddingHorizontal: space.gutter, gap: space.md }}>
        {loading ? <SkeletonRows count={4} inset={0} /> : null}
        {board.error ? <Notice kind="error">{errorMessage(board.error)}</Notice> : null}
      </View>
    );
  const staff = b.viewer.staff;
  const labels = [...new Set(b.columns.flatMap((column) => column.tasks.flatMap((task) => task.labels)))].sort((x, y) => x.localeCompare(y, "pt-BR"));
  return (
    <TaskForm
      initial={{ title: "", description: "", status: staff ? "todo" : undefined, priority: "normal", dueDate: "", estimate: "", labels: [], assigneeIds: [] }}
      intro={staff ? `Nova tarefa em ${b.name}.` : "Entra no Backlog como pedido. A equipe confirma se ele faz parte do combinado."}
      people={b.people}
      priorities={b.priorities}
      statuses={staff ? b.columns.map((column) => ({ value: column.status, label: column.label })) : undefined}
      labelSuggestions={labels}
      engagementId={projeto}
      submitLabel="Criar tarefa"
      pendingLabel="Criando…"
      busy={create.isPending}
      error={create.error ? errorMessage(create.error) : null}
      onSubmit={(values) => create.mutate(values)}
    />
  );
}
