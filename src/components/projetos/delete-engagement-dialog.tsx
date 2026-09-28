"use client";
import { ConfirmDialog } from "@/components/console/server-form";
import { deleteEngagement } from "@/lib/projects/engagement-deletion";

const nouns = { project: "projeto", product: "produto", service: "serviço" } as const;

/** What goes with a project's board, when the page knows how many tasks it has. */
function boardText(tasks: number | undefined) {
  if (tasks === undefined) return " com o quadro de tarefas, os responsáveis e os anexos";
  if (tasks === 0) return "";
  return tasks === 1
    ? " com a tarefa do quadro, os responsáveis e os anexos dela"
    : ` com as ${tasks} tarefas do quadro, os responsáveis e os anexos delas`;
}

/**
 * Staff-only confirmation that deletes a project, product or service for good.
 * The server refuses when invoices, recurrences or contracts point at it; pages
 * only offer it when `canDeleteEngagement` agrees. From a list (`fromList`) the
 * list refreshes in place; from its own page the action goes back to the list.
 */
export function DeleteEngagementDialog({
  engagement,
  tasks,
  fromList = false,
  open,
  onOpenChange,
}: {
  engagement: { id: string; name: string; kind: keyof typeof nouns };
  /** Tasks on a project's board, to say what goes with it. */
  tasks?: number;
  fromList?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const noun = nouns[engagement.kind];
  const board = engagement.kind === "project" ? boardText(tasks) : "";
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      action={deleteEngagement}
      fields={fromList ? { id: engagement.id, from: "list" } : { id: engagement.id }}
      title={`Excluir ${noun}?`}
      description={`${engagement.name} sai do Console${board}. Chamados ligados a ele continuam, sem o vínculo. Isso não pode ser desfeito.`}
      confirmLabel="Excluir"
      destructive
    />
  );
}
