"use client";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
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
import { DateField } from "@/components/console/date-field";
import {
  ConfirmDialog,
  FormError,
  ServerForm,
  SubmitButton,
} from "@/components/console/server-form";
import { AttachmentField } from "@/components/console/attachment-field";
import { FileChip, FileChips } from "@/components/console/file-chip";
import { useTicketUploads } from "@/components/chamados/ticket-uploads";
import { createTask, deleteTask, removeTaskFile, updateTask } from "@/lib/task-actions";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  minutesToHours,
  taskPriorityLabels,
  taskStatusLabels,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/task-model";
import { relativeLabel } from "@/lib/format";
import { LabelField } from "./label-field";
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
  createdBy: string;
  creator: string | null;
  updatedAt: string;
};
export type BoardPerson = PersonOption;
export type TaskEditor =
  | { mode: "create"; status: TaskStatus }
  | { mode: "edit"; task: BoardTask };

/** Removes attachments through one hidden form that lives outside the sheet's form. */
function useFileRemoval() {
  const formRef = useRef<HTMLFormElement>(null);
  const [fileId, setFileId] = useState("");
  const remove = (id: string) => {
    flushSync(() => setFileId(id));
    formRef.current?.requestSubmit();
  };
  const form = (
    <ServerForm ref={formRef} action={removeTaskFile}>
      <input type="hidden" name="id" value={fileId} />
    </ServerForm>
  );
  return { remove, form };
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
  const uploads = useTicketUploads();
  const { remove, form: removalForm } = useFileRemoval();
  const task = editor?.mode === "edit" ? editor.task : null;
  const status = editor?.mode === "create" ? editor.status : (task?.status ?? "todo");
  const canDelete = !!task && (viewer.admin || task.createdBy === viewer.id);
  const canRemoveFile = (file: TaskFile) =>
    viewer.admin || file.authorId === viewer.id || task?.createdBy === viewer.id;
  return (
    <>
      <Sheet open={editor !== null} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          <ServerForm
            key={task?.id ?? `new-${status}`}
            action={task ? updateTask : createTask}
            prepare={uploads}
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
                    rows={5}
                    maxLength={5000}
                    defaultValue={task?.description ?? ""}
                    placeholder="Contexto, o que precisa estar pronto, links úteis."
                    className="min-h-28"
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
                    <Label htmlFor="task-assignees" className="mb-1.5">
                      Responsáveis
                    </Label>
                    <PeopleField
                      id="task-assignees"
                      people={people}
                      defaultValue={task?.assignees.map((person) => person.id) ?? []}
                    />
                  </div>
                  <div>
                    <Label htmlFor="task-due" className="mb-1.5">
                      Prazo
                    </Label>
                    <DateField
                      id="task-due"
                      name="dueDate"
                      defaultValue={task?.dueDate ?? ""}
                      placeholder="Sem prazo"
                    />
                  </div>
                  <div>
                    <Label htmlFor="task-estimate" className="mb-1.5">
                      Estimativa (horas)
                    </Label>
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
                  </div>
                  <div>
                    <Label htmlFor="task-labels" className="mb-1.5">
                      Etiquetas
                    </Label>
                    <LabelField
                      id="task-labels"
                      defaultValue={task?.labels ?? []}
                      suggestions={labelSuggestions}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="task-files" className="mb-1.5">
                    Anexos
                  </Label>
                  {task && task.files.length > 0 && (
                    <FileChips className="mb-3">
                      {task.files.map((file) => (
                        <li key={file.id}>
                          <FileChip
                            file={file}
                            href={`/api/anexos/${file.id}`}
                            onRemove={canRemoveFile(file) ? () => remove(file.id) : undefined}
                          />
                        </li>
                      ))}
                    </FileChips>
                  )}
                  <AttachmentField id="task-files" />
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
      {removalForm}
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
