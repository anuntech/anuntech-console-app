"use client";
import { useState } from "react";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ConfirmDialog,
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { createTask, deleteTask, updateTask } from "@/lib/task-actions";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  taskPriorityLabels,
  taskStatusLabels,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/task-model";
import { relativeLabel } from "@/lib/format";

export type BoardTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  assignee: string | null;
  dueDate: string | null;
  createdBy: string;
  creator: string | null;
  updatedAt: string;
};
export type BoardPerson = { id: string; name: string };
export type TaskEditor =
  | { mode: "create"; status: TaskStatus }
  | { mode: "edit"; task: BoardTask };

/**
 * One sheet for creating and editing a task. The column is a field like any
 * other, so the sheet also moves cards for whoever cannot drag them.
 */
export function TaskSheet({
  editor,
  onClose,
  projectId,
  people,
  viewer,
  now,
}: {
  editor: TaskEditor | null;
  onClose: () => void;
  projectId: string;
  people: BoardPerson[];
  viewer: { id: string; admin: boolean };
  now: string;
}) {
  const [deleting, setDeleting] = useState(false);
  const task = editor?.mode === "edit" ? editor.task : null;
  const status = editor?.mode === "create" ? editor.status : (task?.status ?? "todo");
  const canDelete = !!task && (viewer.admin || task.createdBy === viewer.id);
  return (
    <>
      <Sheet open={editor !== null} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          <ServerForm
            key={task?.id ?? `new-${status}`}
            action={task ? updateTask : createTask}
            onSuccess={onClose}
            className="flex h-full min-h-0 flex-col"
          >
            {task ? (
              <input type="hidden" name="id" value={task.id} />
            ) : (
              <input type="hidden" name="engagementId" value={projectId} />
            )}
            <SheetHeader className="border-b px-6 py-5">
              <SheetTitle>{task ? "Tarefa" : "Nova tarefa"}</SheetTitle>
              <SheetDescription>
                {task
                  ? `${task.creator ? `Criada por ${task.creator} · ` : ""}atualizada ${relativeLabel(task.updatedAt, now)}`
                  : `Entra na coluna ${taskStatusLabels[status]}.`}
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <FormError className="mb-5" />
              <div className="grid gap-5">
                <div>
                  <Label htmlFor="task-title" className="mb-1.5">
                    Título
                  </Label>
                  <Input
                    id="task-title"
                    name="title"
                    required
                    maxLength={200}
                    autoFocus
                    defaultValue={task?.title ?? ""}
                    placeholder="O que precisa ser feito"
                  />
                </div>
                <div>
                  <Label htmlFor="task-description" className="mb-1.5">
                    Descrição
                  </Label>
                  <Textarea
                    id="task-description"
                    name="description"
                    rows={6}
                    maxLength={5000}
                    defaultValue={task?.description ?? ""}
                    placeholder="Contexto, o que precisa estar pronto, links úteis."
                    className="min-h-32"
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="task-status" className="mb-1.5">
                      Coluna
                    </Label>
                    <NativeSelect id="task-status" name="status" defaultValue={status} className="bg-field">
                      {TASK_STATUSES.map((value) => (
                        <NativeSelectOption key={value} value={value}>
                          {taskStatusLabels[value]}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                  <div>
                    <Label htmlFor="task-priority" className="mb-1.5">
                      Prioridade
                    </Label>
                    <NativeSelect
                      id="task-priority"
                      name="priority"
                      defaultValue={task?.priority ?? "normal"}
                      className="bg-field"
                    >
                      {TASK_PRIORITIES.map((value) => (
                        <NativeSelectOption key={value} value={value}>
                          {taskPriorityLabels[value]}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                  <div>
                    <Label htmlFor="task-assignee" className="mb-1.5">
                      Responsável
                    </Label>
                    <NativeSelect
                      id="task-assignee"
                      name="assigneeId"
                      defaultValue={task?.assigneeId ?? ""}
                      className="bg-field"
                    >
                      <NativeSelectOption value="">Sem responsável</NativeSelectOption>
                      {people.map((person) => (
                        <NativeSelectOption key={person.id} value={person.id}>
                          {person.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                  <div>
                    <Label htmlFor="task-due" className="mb-1.5">
                      Prazo
                    </Label>
                    <Input
                      id="task-due"
                      type="date"
                      name="dueDate"
                      defaultValue={task?.dueDate ?? ""}
                      className="bg-field"
                    />
                  </div>
                </div>
              </div>
            </div>
            <SheetFooter className="flex-row items-center gap-2 border-t px-6 py-4 sm:justify-end">
              {canDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  className="mr-auto text-destructive hover:text-destructive"
                  onClick={() => setDeleting(true)}
                >
                  <Trash2Icon />
                  Excluir
                </Button>
              )}
              <SheetClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </SheetClose>
              <SubmitButton pendingLabel="Salvando…">
                {task ? "Salvar" : "Criar tarefa"}
              </SubmitButton>
            </SheetFooter>
          </ServerForm>
        </SheetContent>
      </Sheet>
      {task && (
        <ConfirmDialog
          open={deleting}
          onOpenChange={setDeleting}
          action={deleteTask}
          fields={{ id: task.id }}
          title="Excluir tarefa?"
          description={`"${task.title}" sai do quadro. Isso não pode ser desfeito.`}
          confirmLabel="Excluir"
          destructive
          onSuccess={onClose}
        />
      )}
    </>
  );
}
