"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { automationEvents } from "@/db/schema";
import { getActor } from "../access/access";
import type { ActionState } from "../action-state";
import { db } from "../db";

/** "Não é teste": the record leaves the cleanup list for good. */
export async function keepRecord(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Você não tem permissão para fazer isso." };
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return { error: "Registro não encontrado." };
  await db.insert(automationEvents).values({ kind: "cleanup.keep", entityId: id.data, actorId: actor.user.id }).onConflictDoNothing();
  revalidatePath("/configuracoes/limpeza");
  return { success: "Fica fora da lista de limpeza." };
}
