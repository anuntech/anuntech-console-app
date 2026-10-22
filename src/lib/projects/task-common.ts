import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "../action-state";
import { logDatabaseFault } from "../action-errors";

/** What the person reads when a board action fails (task-actions and the review). */
export const taskFailure = (error: unknown): ActionState => ({
  error:
    error instanceof z.ZodError
      ? error.issues[0].message
      : error instanceof Error && !logDatabaseFault("tasks", error) && /etiqueta|estimativa|pessoa/i.test(error.message)
        ? error.message
        : "Não foi possível salvar. Confira os dados e tente novamente.",
});

/** The pages that show a board, after it changed (from the web or the app). */
export function refreshBoard(engagementId: string) {
  revalidatePath(`/projetos/${engagementId}`);
  revalidatePath("/projetos");
  revalidatePath("/produtos");
}

/** Spaced positions let a card slot between two others without renumbering. */
export const STEP = 1024;
