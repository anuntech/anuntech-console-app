"use server";
import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../db";
import { getActor } from "../access/access";
import { assistantDocuments, assistantSettings, auditEvents } from "@/db/schema";
import type { ActionState } from "../action-state";
import { DEFAULT_ASSISTANT_MODEL } from "./assistant";
import { openRouterModels } from "./openrouter-models";
import { KNOWLEDGE_DOCUMENT, limitLabel } from "../tickets/attachment-rules";

const blocked = { error: "Você não tem permissão para fazer isso." };
const MAX_DOCUMENTS = 30;
const MAX_DOCUMENT_BYTES = KNOWLEDGE_DOCUMENT.maxBytes;
const tooLarge = `Cada documento pode ter até ${limitLabel(MAX_DOCUMENT_BYTES)}. Divida em partes.`;
const refresh = () => revalidatePath("/configuracoes/assistente");
const failure = (e: unknown, fallback: string): ActionState => ({
  error: e instanceof z.ZodError ? e.issues[0].message : e instanceof Error && e.message ? e.message : fallback,
});

/** Model id and the extra instructions; the built-in prompt stays in code. */
export async function saveAssistantSettings(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z
      .object({
        model: z.string().trim().max(120, "O id do modelo é longo demais."),
        prompt: z
          .string()
          .transform((v) => v.replace(/\r\n?/g, "\n"))
          .pipe(z.string().trim().max(20000, "As instruções podem ter até 20 mil caracteres.")),
      })
      .parse({ model: form.get("model") ?? "", prompt: form.get("prompt") ?? "" });
    const model = input.model || DEFAULT_ASSISTANT_MODEL;
    // Free variants are served by providers that log prompts to train on them: client data never goes there.
    if (/:free$/i.test(model)) return { error: "Modelos gratuitos (:free) guardam o que recebem. Escolha um modelo pago." };
    // Anything the live catalog lists is fine (aliases start with "~"); otherwise the id must look like provider/model.
    const known = (await openRouterModels()).some((m) => m.id === model);
    if (!known && !/^~?[\w.\-]+\/[\w.\-:]+$/u.test(model))
      return { error: "Use o id como aparece no OpenRouter, por exemplo anthropic/claude-sonnet-5 ou ~deepseek/deepseek-flash-latest." };
    await db
      .insert(assistantSettings)
      .values({ id: "default", model, prompt: input.prompt, updatedBy: actor.user.id, updatedAt: new Date() })
      .onConflictDoUpdate({ target: assistantSettings.id, set: { model, prompt: input.prompt, updatedBy: actor.user.id, updatedAt: new Date() } });
    await db.insert(auditEvents).values({ actorId: actor.user.id, entityId: "default", action: "assistant.settings_updated", details: { model } });
    refresh();
    return { success: "Assistente atualizado." };
  } catch (e) {
    return failure(e, "Não foi possível salvar as configurações do assistente.");
  }
}

/** A text document for the knowledge base: an uploaded .md/.txt file or pasted text. */
export async function addAssistantDocument(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const file = form.get("file");
    const pasted = String(form.get("content") ?? "");
    let name = String(form.get("name") ?? "").trim();
    let content = pasted;
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_DOCUMENT_BYTES) return { error: tooLarge };
      if (!/\.(md|markdown|txt|csv)$/i.test(file.name)) return { error: "Envie um arquivo .md, .txt ou .csv. PDFs e documentos do Word não são lidos." };
      content = await file.text();
      name = name || file.name.replace(/\.[^.]+$/, "");
    }
    content = content.replace(/\r\n?/g, "\n").replace(/\u0000/g, "").trim();
    if (!content) return { error: "Envie um arquivo ou cole o texto do documento." };
    if (Buffer.byteLength(content) > MAX_DOCUMENT_BYTES) return { error: tooLarge };
    name = z.string().trim().min(1, "Dê um nome ao documento.").max(120, "O nome pode ter até 120 caracteres.").parse(name);
    const [{ n }] = await db.select({ n: count() }).from(assistantDocuments);
    if (n >= MAX_DOCUMENTS) return { error: `A base comporta até ${MAX_DOCUMENTS} documentos. Remova ou junte alguns.` };
    const [row] = await db
      .insert(assistantDocuments)
      .values({ name, content, bytes: Buffer.byteLength(content), authorId: actor.user.id })
      .returning({ id: assistantDocuments.id });
    await db.insert(auditEvents).values({ actorId: actor.user.id, entityId: row.id, action: "assistant.document_added", details: { name } });
    refresh();
    return { success: `"${name}" entrou na base de conhecimento.` };
  } catch (e) {
    return failure(e, "Não foi possível adicionar o documento.");
  }
}

export async function removeAssistantDocument(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const documentId = z.string().uuid().parse(form.get("id"));
    const [doc] = await db.select({ name: assistantDocuments.name }).from(assistantDocuments).where(eq(assistantDocuments.id, documentId));
    if (!doc) return { error: "Documento não encontrado." };
    await db.delete(assistantDocuments).where(eq(assistantDocuments.id, documentId));
    await db.insert(auditEvents).values({ actorId: actor.user.id, entityId: documentId, action: "assistant.document_removed", details: { name: doc.name } });
    refresh();
    return { success: `"${doc.name}" saiu da base de conhecimento.` };
  } catch (e) {
    return failure(e, "Não foi possível remover o documento.");
  }
}
