"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditEvents, companies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getActor } from "../access/access";
import type { ActionState } from "../action-state";
import { db } from "../db";
import { saoPauloDate } from "../dates";
import { addDays } from "./recurrence";

/**
 * "Registrar contato": who on the team talked to an overdue client, what was
 * agreed and, with a promise to pay, until when the client stays off the queue.
 */
export async function registerCollectionContact(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Você não tem permissão para fazer isso." };
  const today = saoPauloDate();
  const parsed = z
    .object({
      companyId: z.string().uuid(),
      note: z.string().trim().min(3, "Conte o que foi combinado.").max(1000),
      promiseDate: z.union([z.iso.date(), z.literal("")]).default(""),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;
  if (input.promiseDate && (input.promiseDate < today || input.promiseDate > addDays(today, 60)))
    return { error: "A data combinada precisa estar entre hoje e os próximos 60 dias." };
  const [company] = await db.select({ id: companies.id }).from(companies).where(eq(companies.id, input.companyId));
  if (!company) return { error: "Empresa não encontrada." };
  await db.insert(auditEvents).values({
    actorId: actor.user.id,
    companyId: input.companyId,
    entityId: input.companyId,
    action: "collection.contact",
    details: { note: input.note, promiseDate: input.promiseDate || null },
  });
  revalidatePath("/financeiro/atrasos");
  revalidatePath("/painel");
  return { success: input.promiseDate ? "Contato registrado. A empresa sai da fila até a data combinada." : "Contato registrado." };
}
