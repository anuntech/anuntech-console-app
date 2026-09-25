"use server";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  attachments,
  auditEvents,
  companies,
  engagements,
  taskAssignees,
  tasks,
  tickets,
} from "@/db/schema";
import { getActor } from "./access";
import type { ActionState } from "./action-state";
import { db } from "./db";
import { ENGAGEMENT_DELETE_REFUSAL, canDeleteEngagement } from "./deletion-rules";
import { engagementLinks } from "./record-links";

/** A refusal whose message is safe to show; anything else gets the generic one. */
class Refusal extends Error {}

const deletedLabel = {
  project: "Projeto excluído.",
  product: "Produto excluído.",
  service: "Serviço excluído.",
} as const;

/**
 * Deletes a project, product or service for good, with its tasks (people and
 * attachments; file content lives in the row, so nothing is left in storage).
 * Tickets that mentioned it stay, without the link. Refused while an invoice,
 * recurrence or contract points at it. Staff only; the audit event keeps the
 * name and the company so the log still reads after the row is gone. With
 * `from=list` the list stays where it is instead of navigating back to it.
 */
export async function deleteEngagement(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Só a equipe da Anuntech pode excluir." };
  const engagementId = z.string().uuid().safeParse(form.get("id"));
  if (!engagementId.success) return { error: "Item não encontrado." };
  try {
    const deleted = await db.transaction(async (tx) => {
      // Locked so an invoice, contract or task racing this delete either lands
      // first (and is counted below) or waits and then fails on the missing row.
      const [row] = await tx
        .select()
        .from(engagements)
        .where(eq(engagements.id, engagementId.data))
        .for("update");
      if (!row) throw new Refusal("Item não encontrado. Ele pode já ter sido excluído.");
      const links = (await engagementLinks([row.id], tx)).get(row.id);
      if (!canDeleteEngagement(links)) throw new Refusal(ENGAGEMENT_DELETE_REFUSAL);
      const [company] = await tx
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, row.companyId));
      const itsTasks = tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(eq(tasks.engagementId, row.id));
      const files = await tx
        .delete(attachments)
        .where(inArray(attachments.taskId, itsTasks))
        .returning({ id: attachments.id });
      await tx.delete(taskAssignees).where(inArray(taskAssignees.taskId, itsTasks));
      const removedTasks = await tx
        .delete(tasks)
        .where(eq(tasks.engagementId, row.id))
        .returning({ id: tasks.id });
      const unlinked = await tx
        .update(tickets)
        .set({ engagementId: null })
        .where(eq(tickets.engagementId, row.id))
        .returning({ id: tickets.id });
      await tx.delete(engagements).where(eq(engagements.id, row.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: row.companyId,
        action: "engagement.deleted",
        entityId: row.id,
        details: {
          name: row.name,
          kind: row.kind,
          status: row.status,
          company: company?.name ?? null,
          tasks: removedTasks.length,
          files: files.length,
          ticketsUnlinked: unlinked.length,
        },
      });
      return { ...row, ticketsUnlinked: unlinked.length };
    });
    const success = deletedLabel[deleted.kind];
    // From a detail page, revalidating would re-render the deleted record's page (a
    // 404) inside this response; the list loads fresh when we navigate to it.
    if (form.get("from") !== "list") return { success, href: deleted.kind === "project" ? "/projetos" : "/produtos" };
    revalidatePath("/projetos");
    revalidatePath("/produtos");
    revalidatePath(`/empresas/${deleted.companyId}`);
    revalidatePath("/painel");
    if (deleted.ticketsUnlinked) {
      revalidatePath("/chamados");
      revalidatePath("/chamados/[id]", "page");
    }
    return { success };
  } catch (e) {
    if (!(e instanceof Refusal)) console.error("[delete] engagement failed", e);
    return {
      error: e instanceof Refusal ? e.message : "Não foi possível excluir. Tente novamente.",
    };
  }
}
