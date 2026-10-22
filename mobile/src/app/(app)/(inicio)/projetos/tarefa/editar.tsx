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
 * Editing a task (projects.updateTask): every field, new files and the saved
 * ones to remove, which go only when it saves. The column stays as it is;
 * it changes from the task's detail.
 */
export default function EditTask() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const task = useQuery({ queryKey: ["task", id], queryFn: () => api.projects.task({ id }) });
  const projectId = task.data?.project.id;
  const board = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.projects.get({ id: projectId! }),
    enabled: !!projectId,
  });
  const loading = useDelayed(task.isPending || board.isPending);
  const save = useMutation({
    mutationFn: (values: TaskValues) =>
      api.projects.updateTask({
        id,
        status: task.data!.status,
        title: values.title,
        description: values.description,
        priority: values.priority as "low" | "normal" | "high" | "urgent",
        dueDate: values.dueDate,
        estimate: values.estimate,
        labels: values.labels,
        assigneeIds: values.assigneeIds,
        uploadIds: values.uploadIds,
        removeFileIds: values.removeFileIds,
      }),
    onSuccess: async ({ message }) => {
      haptic.success();
      showFlash(message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["task", id] }),
        queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["project-activity", projectId] }),
      ]);
      router.back();
    },
    onError: () => haptic.error(),
  });
  const t = task.data;
  const b = board.data;
  if (!t || !b)
    return (
      <View style={{ paddingTop: space.xl, paddingHorizontal: space.gutter, gap: space.md }}>
        {loading ? <SkeletonRows count={4} inset={0} /> : null}
        {task.error || board.error ? <Notice kind="error">{errorMessage(task.error ?? board.error)}</Notice> : null}
      </View>
    );
  const labels = [...new Set(b.columns.flatMap((column) => column.tasks.flatMap((x) => x.labels)))].sort((x, y) => x.localeCompare(y, "pt-BR"));
  return (
    <TaskForm
      initial={{
        title: t.title,
        description: t.description ?? "",
        priority: t.priority,
        dueDate: t.dueDate ?? "",
        estimate: t.estimateHours,
        labels: t.labels,
        assigneeIds: t.assignees.map((person) => person.id),
      }}
      // Someone already on the task stays pickable even after losing access, as on the web.
      people={[...b.people, ...t.assignees.filter((person) => !b.people.some((p) => p.id === person.id))]}
      priorities={b.priorities}
      labelSuggestions={labels}
      savedFiles={t.files}
      engagementId={b.id}
      submitLabel="Salvar"
      pendingLabel="Salvando…"
      busy={save.isPending}
      error={save.error ? errorMessage(save.error) : null}
      onSubmit={(values) => save.mutate(values)}
    />
  );
}
