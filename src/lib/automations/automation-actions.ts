"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auditEvents, environmentProfile } from "@/db/schema";
import { getActor } from "../access/access";
import type { ActionState } from "../action-state";
import { db } from "../db";
import { automationKeys } from "./automation-list";

/** Staff turn each automation on or off; the change is in the audit log. */
export async function saveAutomations(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Você não tem permissão para fazer isso." };
  const off = Object.fromEntries(automationKeys.filter((key) => form.get(key) !== "on").map((key) => [key, false]));
  const [row] = await db
    .update(environmentProfile)
    .set({ automations: off, updatedAt: new Date() })
    .where(eq(environmentProfile.id, "console"))
    .returning({ id: environmentProfile.id });
  if (!row) return { error: "Salve primeiro os dados da Anuntech em Configurações → Dados da empresa." };
  await db.insert(auditEvents).values({ actorId: actor.user.id, action: "settings.automations_updated", entityId: "console", details: { off: Object.keys(off) } });
  revalidatePath("/configuracoes/automacoes");
  return { success: Object.keys(off).length ? "Automações salvas. As desligadas param na próxima rotina." : "Todas as automações estão ligadas." };
}
