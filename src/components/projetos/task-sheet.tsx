"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { DateField } from "@/components/console/date-field";
import { ConfirmDialog } from "@/components/console/server-form";
import { FormSheet } from "@/components/console/form-sheet";
import { FormField } from "@/components/console/form-field";
import { AttachmentField } from "@/components/console/attachment-field";
import { FileChip, FileChips } from "@/components/console/file-chip";
import { useStagedUploads } from "@/components/console/staged-uploads";
import { createTask, deleteTask, updateTask } from "@/lib/projects/task-actions";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  minutesToHours,
  taskPriorityLabels,
  taskStatusLabels,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/projects/task-model";
import { relativeLabel } from "@/lib/format";
import { LabelField } from "./label-field";
import { TaskComments, type BoardComment } from "./task-comments";
import { PeopleField, type PersonOption } from "@/components/console/people-field";

export type TaskFile = {
  id: string;
  name: string;
  size: number;
  mime: string;
  authorId: string;
};
export type BoardTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignees: PersonOption[];
  dueDate: string | null;
  labels: string[];
  estimateMinutes: number | null;
  files: TaskFile[];
  comments: BoardComment[];
  createdBy: string;
  creator: string | null;
  updatedAt: string;
  /** Created by the client and not yet taken into the work by the team. */
  requested?: boolean;
  /** In Revisão: until when the client tests it, when the contract sets a window. */
  reviewDue?: string | null;
  approvedAt?: string | null;
};
export type BoardPerson = PersonOption;
export type TaskEditor =
  | { mode: "create"; status: TaskStatus }
  | { mode: "edit"; task: BoardTask };

/**
 * Saved files first, then the picker. Removing a saved file only marks it:
 * the chip stays, struck through, with "Desfazer", and a hidden
 * `removeFileId` tells updateTask to delete it when the sheet is saved.
 * Cancelar closes the sheet and the marks go with it.
 */
function TaskFiles({
  files,
  canRemove,
}: {
  files: TaskFile[];
  canRemove: (file: TaskFile) => boolean;
}) {
  const [marked, setMarked] = useState<string[]>([]);
  return (
    <FormField label="Anexos" htmlFor="task-files">
      {files.length > 0 && (
        <FileChips className="mb-3">
          {files.map((file) => {
            const removing = marked.includes(file.id);
            return (
              <li key={file.id}>
                <FileChip
                  file={file}
                  href={`/api/anexos/${file.id}`}
                  onRemove={canRemove(file) ? () => setMarked((ids) => [...ids, file.id]) : undefined}
                  onRestore={removing ? () => setMarked((ids) => ids.filter((id) => id !== file.id)) : undefined}
                />
                {removing && <input type="hidden" name="removeFileId" value={file.id} />}
              </li>
            );
          })}
        </FileChips>
      )}
      <AttachmentField id="task-files" />
    </FormField>
  );
}

/**
 * One sheet for creating and editing a task. The column is a field like any
 * other, so the sheet also moves cards for whoever cannot drag them.
 */
export function TaskSheet({
  editor,
  onClose,
  projectId,
  people,
  labelSuggestions = [],
  viewer,
  now,
}: {
  editor: TaskEditor | null;
  onClose: () => void;
  projectId: string;
  people: BoardPerson[];
  labelSuggestions?: string[];
  viewer: { id: string; admin: boolean };
  now: string;
}) {
  const [deleting, setDeleting] = useState(false);
  // The sheet keeps showing what it had while it slides out after closing.
  const [shown, setShown] = useState(editor);
  if (editor && editor !== shown) setShown(editor);
  const current = editor ?? shown;
  const uploads = useStagedUploads();
  const task = current?.mode === "edit" ? current.task : null;
  const status = current?.mode === "create" ? current.status : (task?.status ?? "todo");
  const canDelete = !!task && (viewer.admin || task.createdBy === viewer.id);
  const canRemoveFile = (file: TaskFile) =>
    viewer.admin || file.authorId === viewer.id || task?.createdBy === viewer.id;
  return (
    <>
      <FormSheet
        open={editor !== null}
        onOpenChange={(open) => !open && onClose()}
        size="xl"
        title={task ? "Editar tarefa" : "Nova tarefa"}
        description={
          task
            ? `${task.creator ? `Criada por ${task.creator} · ` : ""}atualizada ${relativeLabel(task.updatedAt, now)}`
            : viewer.admin
              ? `Entra na coluna ${taskStatusLabels[status]}.`
              : "Entra no Backlog como pedido. A equipe confirma se ele faz parte do combinado."
        }
        action={task ? updateTask : createTask}
        prepare={uploads}
        onSuccess={onClose}
        formKey={task?.id ?? `new-${status}`}
        submitLabel={task ? "Salvar" : "Criar tarefa"}
        pendingLabel={task ? "Salvando…" : "Criando…"}
        onDelete={canDelete ? () => setDeleting(true) : undefined}
        tabs={
          task
            ? [
                {
                  value: "comments",
                  label: (
                    <>
                      Comentários
                      {task.comments.length > 0 && (
                        <span className="rounded-full bg-secondary px-1.5 text-[11px] leading-4 text-muted-foreground tabular-nums">
                          {task.comments.length}
                        </span>
                      )}
                    </>
                  ),
                  content: <TaskComments taskId={task.id} comments={task.comments} viewer={viewer} now={now} />,
                },
              ]
            : undefined
        }
      >
        {task ? (
          <input type="hidden" name="id" value={task.id} />
        ) : (
          <input type="hidden" name="engagementId" value={projectId} />
        )}
        <FormField label="Título" htmlFor="task-title">
          <Input
            id="task-title"
            name="title"
            required
            maxLength={200}
            autoFocus
            defaultValue={task?.title ?? ""}
            placeholder="O que precisa ser feito"
          />
        </FormField>
        <FormField label="Descrição" htmlFor="task-description">
          <Textarea
            id="task-description"
            name="description"
            rows={5}
            maxLength={5000}
            defaultValue={task?.description ?? ""}
            placeholder="Contexto, o que precisa estar pronto, links úteis."
            className="min-h-28"
          />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          {!task && !viewer.admin ? (
            <input type="hidden" name="status" value="backlog" />
          ) : (
            <FormField label="Coluna" htmlFor="task-status">
              <NativeSelect id="task-status" name="status" defaultValue={status}>
                {/* Only the team concludes; in Revisão the client approves instead. */}
                {TASK_STATUSES.filter((value) => viewer.admin || value === status || (value !== "done" && value !== "review" && status !== "review")).map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {taskStatusLabels[value]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
          )}
          <FormField label="Prioridade" htmlFor="task-priority">
            <NativeSelect id="task-priority" name="priority" defaultValue={task?.priority ?? "normal"}>
              {TASK_PRIORITIES.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {taskPriorityLabels[value]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Responsáveis" htmlFor="task-assignees">
            <PeopleField
              id="task-assignees"
              people={people}
              defaultValue={task?.assignees.map((person) => person.id) ?? []}
            />
          </FormField>
          <FormField label="Prazo" htmlFor="task-due">
            <DateField
              id="task-due"
              name="dueDate"
              defaultValue={task?.dueDate ?? ""}
              placeholder="Sem prazo"
            />
          </FormField>
          <FormField label="Estimativa (horas)" htmlFor="task-estimate">
            <Input
              id="task-estimate"
              name="estimate"
              inputMode="decimal"
              maxLength={10}
              defaultValue={
                task?.estimateMinutes != null ? minutesToHours(task.estimateMinutes) : ""
              }
              placeholder="Ex.: 1,5"
            />
          </FormField>
          <FormField label="Etiquetas" htmlFor="task-labels">
            <LabelField
              id="task-labels"
              defaultValue={task?.labels ?? []}
              suggestions={labelSuggestions}
            />
          </FormField>
        </div>
        <TaskFiles files={task?.files ?? []} canRemove={canRemoveFile} />
      </FormSheet>
      {task && (
        <ConfirmDialog
          open={deleting}
          onOpenChange={setDeleting}
          action={deleteTask}
          fields={{ id: task.id }}
          title="Excluir tarefa?"
          description={`"${task.title}" sai do quadro, com os anexos. Isso não pode ser desfeito.`}
          confirmLabel="Excluir"
          destructive
          onSuccess={onClose}
        />
      )}
    </>
  );
}
