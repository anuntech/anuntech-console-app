import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "../action-state";
import { DATABASE_FAILURE, logDatabaseFault } from "../action-errors";

/** The unique index that holds one signature per party and version (drizzle/0042). */
export const SIGNATURE_PER_VERSION = "console_contract_signature_version_party_unique";

/** What the person reads when a contract action fails (contract-actions and signing). */
export const contractFailure = (e: unknown): ActionState => {
  // A database refusal never reaches the screen as is: its message carries the SQL and every value sent.
  const fault = logDatabaseFault("contracts", e);
  // The same party signing the same version twice: the check under the contract's lock answers first;
  // the index is what still holds if that check ever goes.
  if (fault?.code === "23505" && fault.constraint === SIGNATURE_PER_VERSION)
    return { error: "Esta parte já assinou esta versão do contrato." };
  if (fault) return { error: DATABASE_FAILURE };
  return {
    error:
      e instanceof z.ZodError
        ? e.issues[0].message
        : e instanceof Error && e.message === "stale"
          ? "O contrato mudou em outra aba. Atualize a página antes de continuar."
          : e instanceof Error && e.message
            ? e.message
            : "Não foi possível salvar o contrato. Confira os dados e tente novamente.",
  };
};

/** The pages that show a contract, after it changed (from the web or the app). */
export function refreshContracts(contractId?: string, parentId?: string | null) {
  revalidatePath("/contratos");
  revalidatePath("/configuracoes/contratos");
  if (contractId) revalidatePath(`/contratos/${contractId}`);
  if (parentId) revalidatePath(`/contratos/${parentId}`);
}
