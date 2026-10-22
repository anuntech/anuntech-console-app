import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "../action-state";
import { DATABASE_FAILURE, logDatabaseFault } from "../action-errors";

/** What the person reads when a quote action fails (quote-actions and the answer). */
export const quoteFailure = (e: unknown): ActionState => ({
  error: logDatabaseFault("quotes", e)
    ? DATABASE_FAILURE
    : e instanceof z.ZodError
      ? e.issues[0].message
      : e instanceof Error && e.message === "stale"
        ? "O orçamento mudou em outra aba. Atualize a página antes de continuar."
        : e instanceof Error && e.message
          ? e.message
          : "Não foi possível salvar o orçamento. Confira os dados e tente novamente.",
});

/** The pages that show a quote, after it changed (from the web or the app). */
export function refreshQuotes(quoteId?: string) {
  revalidatePath("/orcamentos");
  if (quoteId) revalidatePath(`/orcamentos/${quoteId}`);
}

export const consoleUrl = () => process.env.BETTER_AUTH_URL || "http://localhost:3100";
