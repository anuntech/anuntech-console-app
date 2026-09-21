"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { bookmarks, engagements, auditEvents } from "@/db/schema";
import { db } from "./db";
import { getActor, canAccess } from "./access";
import { bookmarkInput, safeFileName } from "./bookmark-validation";
import type { ActionState } from "./action-state";

export async function saveBookmark(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  const parsed = bookmarkInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;
  if (!canAccess(actor, input.companyId, "overview"))
    return { error: "Você não tem acesso a esta empresa." };
  const file = form.get("file");
  const uploaded = file instanceof File && file.size > 0 ? file : null;
  if (!input.url && !uploaded)
    return { error: "Informe um link ou selecione um arquivo." };
  if (input.url && uploaded)
    return { error: "Salve um link ou um arquivo por vez." };
  if (uploaded && uploaded.size > 1024 * 1024)
    return { error: "Escolha um arquivo de até 1 MB." };
  try {
    if (input.engagementId) {
      const [project] = await db
        .select({ id: engagements.id })
        .from(engagements)
        .where(
          and(
            eq(engagements.id, input.engagementId),
            eq(engagements.companyId, input.companyId),
          ),
        );
      if (!project) return { error: "Projeto inválido para esta empresa." };
    }
    const content = uploaded ? Buffer.from(await uploaded.arrayBuffer()) : null;
    await db.transaction(async (tx) => {
      const [item] = await tx
        .insert(bookmarks)
        .values({
          ...input,
          engagementId: input.engagementId || null,
          url: input.url || null,
          fileName: uploaded ? safeFileName(uploaded.name) : null,
          content,
          authorId: actor.user.id,
        })
        .returning({ id: bookmarks.id });
      await tx
        .insert(auditEvents)
        .values({
          actorId: actor.user.id,
          companyId: input.companyId,
          entityId: item.id,
          action: "bookmark.created",
        });
    });
    revalidatePath("/bookmarks");
    return { success: "Bookmark salvo." };
  } catch {
    return { error: "Não foi possível salvar o bookmark. Tente novamente." };
  }
}
export async function deleteBookmark(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await getActor();
  const bookmarkId = String(form.get("id") || "");
  try {
    const result = await db.transaction(async (tx) => {
      const [item] = await tx
        .select({
          id: bookmarks.id,
          companyId: bookmarks.companyId,
          authorId: bookmarks.authorId,
        })
        .from(bookmarks)
        .where(eq(bookmarks.id, bookmarkId))
        .for("update");
      if (
        !item ||
        !canAccess(actor, item.companyId, "overview") ||
        !(
          actor.admin ||
          item.authorId === actor.user.id ||
          actor.grants.some(
            (g) => g.company.id === item.companyId && g.role === "manager",
          )
        )
      )
        return { error: "Você não pode remover este bookmark." };
      await tx.delete(bookmarks).where(eq(bookmarks.id, item.id));
      await tx
        .insert(auditEvents)
        .values({
          actorId: actor.user.id,
          companyId: item.companyId,
          entityId: item.id,
          action: "bookmark.deleted",
        });
      return { success: "Bookmark removido." };
    });
    revalidatePath("/bookmarks");
    return result;
  } catch {
    return { error: "Não foi possível remover o bookmark." };
  }
}
