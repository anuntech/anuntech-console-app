"use server";
import { revalidatePath } from "next/cache";
import { getActor } from "./access";
import { processTicketNotices } from "./ticket-notifications";
import type { ActionState } from "./action-state";
export async function checkTicketNotices(): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Acesso restrito à administração." };
  try {
    const { processed } = await processTicketNotices();
    revalidatePath("/configuracoes/notificacoes");
    return {
      success: processed
        ? `${processed} aviso(s) verificado(s). Confira as situações abaixo.`
        : "Nenhum aviso pendente de processamento neste momento.",
    };
  } catch {
    return {
      error:
        "Não foi possível verificar a fila agora. As tentativas continuam registradas.",
    };
  }
}
