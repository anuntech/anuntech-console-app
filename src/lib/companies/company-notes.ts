"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditEvents, companies, companyNotes } from "@/db/schema";
import { db } from "../db";
import { getActor } from "../access/access";
import type { ActionState } from "../action-state";
import { DATABASE_FAILURE, logDatabaseFault } from "../action-errors";
import { looksSecret } from "../journeys/journey-model";

/*
 * Anotações: what the team knows about a client and keeps for itself (how they like to be
 * contacted, who decides, what was agreed off the record). Staff only; the client never sees them.
 * Passwords and keys are refused: they belong in a vault.
 */
const blocked = { error: "Você não tem permissão para fazer isso." };
const SECRET_REFUSAL = "Isto parece uma senha, uma chave ou um endereço com senha. Guarde em um cofre; aqui, só a referência.";
const id = z.string().uuid();
const body = z.string().trim().min(1, "Escreva a anotação.").max(5000, "Use até 5.000 caracteres.");
const failure = (e: unknown): ActionState => ({
  error: logDatabaseFault("company notes", e)
    ? DATABASE_FAILURE
    : e instanceof z.ZodError
      ? e.issues[0].message
      : "Não foi possível salvar a anotação.",
});
const refresh = (companyId: string) => revalidatePath(`/empresas/${companyId}`);

export async function addCompanyNote(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z.object({ companyId: id, body }).parse(Object.fromEntries(form));
    if (looksSecret(input.body)) return { error: SECRET_REFUSAL };
    const [company] = await db.select({ id: companies.id }).from(companies).where(eq(companies.id, input.companyId));
    if (!company) return { error: "Empresa não encontrada." };
    const [note] = await db.insert(companyNotes).values({ companyId: company.id, authorId: actor.user.id, body: input.body }).returning({ id: companyNotes.id });
    await db.insert(auditEvents).values({ actorId: actor.user.id, companyId: company.id, action: "company.note_added", entityId: note.id });
    refresh(company.id);
    return { success: "Anotação salva." };
  } catch (e) {
    return failure(e);
  }
}

export async function updateCompanyNote(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z.object({ id, body }).parse(Object.fromEntries(form));
    if (looksSecret(input.body)) return { error: SECRET_REFUSAL };
    const [note] = await db
      .update(companyNotes)
      .set({ body: input.body, updatedAt: new Date() })
      .where(eq(companyNotes.id, input.id))
      .returning({ companyId: companyNotes.companyId });
    if (!note) return { error: "Anotação não encontrada." };
    refresh(note.companyId);
    return { success: "Anotação atualizada." };
  } catch (e) {
    return failure(e);
  }
}

export async function deleteCompanyNote(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z.object({ id }).parse(Object.fromEntries(form));
    const [note] = await db.delete(companyNotes).where(and(eq(companyNotes.id, input.id))).returning({ companyId: companyNotes.companyId });
    if (!note) return { error: "Anotação não encontrada." };
    await db.insert(auditEvents).values({ actorId: actor.user.id, companyId: note.companyId, action: "company.note_deleted", entityId: input.id });
    refresh(note.companyId);
    return { success: "Anotação excluída." };
  } catch (e) {
    return failure(e);
  }
}
