"use client";
import { useState } from "react";
import { CheckIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FormError, ServerForm, SubmitButton } from "@/components/console/server-form";
import { dueLabel } from "@/lib/format";
import { reviewTask } from "@/lib/projects/task-actions";
import type { BoardTask } from "./task-sheet";

/**
 * A delivery in Revisão, answered by the client: approve it, or say what is
 * wrong and send it back to the team. The answer is recorded with who and when.
 */
export function TaskReviewDialog({ task, onClose, now }: { task: BoardTask | null; onClose: () => void; now: string }) {
  const [problem, setProblem] = useState(false);
  return (
    <Dialog
      open={!!task}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setProblem(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Revisar entrega</DialogTitle>
          <DialogDescription>
            {task?.title}
            {task?.reviewDue ? ` · teste até ${dueLabel(task.reviewDue, now)}` : ""}
          </DialogDescription>
        </DialogHeader>
        {task && (
          <ServerForm
            action={reviewTask}
            onSuccess={() => {
              setProblem(false);
              onClose();
            }}
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="decision" value={problem ? "problem" : "approve"} />
            <FormError />
            {problem ? (
              <Textarea
                name="note"
                required
                autoFocus
                rows={4}
                maxLength={5000}
                placeholder="O que você testou e o que não funcionou como esperado."
              />
            ) : (
              <p className="m-0 text-sm text-muted-foreground">
                Teste a entrega. Se estiver como combinado, aprove; se não, conte o que falta e ela volta para a equipe.
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {problem ? (
                <>
                  <Button type="button" variant="ghost" onClick={() => setProblem(false)}>
                    Voltar
                  </Button>
                  <SubmitButton pendingLabel="Enviando…">
                    <TriangleAlertIcon />
                    Enviar para a equipe
                  </SubmitButton>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={() => setProblem(true)}>
                    Encontrei um problema
                  </Button>
                  <SubmitButton pendingLabel="Aprovando…">
                    <CheckIcon />
                    Aprovar
                  </SubmitButton>
                </>
              )}
            </div>
          </ServerForm>
        )}
      </DialogContent>
    </Dialog>
  );
}
