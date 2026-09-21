"use server";
import { revalidatePath } from "next/cache";
import { and, eq, or, inArray, isNull } from "drizzle-orm";
import { db } from "./db";
import { notificationSettings, ticketNotices, auditEvents } from "@/db/schema";
import {
  TICKET_NOTIFICATION_KEY,
  lockTicketNotifications,
  ticketNotificationsEnabled,
} from "./notification-settings";
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

export async function setTicketNotifications(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Acesso restrito à administração." };
  const raw = form.get("enabled");
  if (raw !== "true" && raw !== "false")
    return { error: "Escolha uma opção válida." };
  const enabled = raw === "true";
  try {
    await db.transaction(async (tx) => {
      await lockTicketNotifications(tx, true);
      const before = await ticketNotificationsEnabled(tx);
      await tx
        .insert(notificationSettings)
        .values({
          id: TICKET_NOTIFICATION_KEY,
          enabled,
          updatedBy: actor.user.id,
        })
        .onConflictDoUpdate({
          target: notificationSettings.id,
          set: { enabled, updatedBy: actor.user.id, updatedAt: new Date() },
        });
      if (!enabled)
        await tx
          .update(ticketNotices)
          .set({
            status: "cancelled",
            error: "Notificações desativadas.",
            lockedAt: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              inArray(ticketNotices.status, ["pending", "processing"]),
              isNull(ticketNotices.providerId),
              or(
                isNull(ticketNotices.preferenceKey),
                eq(ticketNotices.preferenceKey, "console:tickets"),
              ),
            ),
          );
      if (before !== enabled)
        await tx.insert(auditEvents).values({
          actorId: actor.user.id,
          action: "notifications.settings.updated",
          entityId: TICKET_NOTIFICATION_KEY,
          details: { enabled },
        });
    });
    revalidatePath("/configuracoes/notificacoes");
    return {
      success: enabled ? "Notificações ativadas." : "Notificações desativadas.",
    };
  } catch {
    return {
      error: "Não foi possível alterar as notificações. Tente novamente.",
    };
  }
}
