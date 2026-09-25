"use server";
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { auditEvents, companies, quoteVersions, quotes } from "@/db/schema";
import { getActor } from "./access";
import type { ActionState } from "./action-state";
import { saoPauloDate } from "./dates";
import { db } from "./db";
import { quoteDeletionBlock } from "./deletion-rules";
import { quoteNumberLabel, quoteTotals } from "./quote-model";

/** A refusal whose message is safe to show; anything else gets the generic one. */
class Refusal extends Error {}

/**
 * Deletes a proposal for good, with its sent versions: drafts, cancelled,
 * accepted, declined and expired ones, never one still waiting for the
 * client. Staff only. The audit event keeps the number, title and company,
 * and for an answered proposal the client's decision with the evidence
 * behind it, so the log still tells the story after the row is gone.
 * From the proposal's page the person goes back to the list; with
 * `from=list` the list refreshes in place, keeping filters and page.
 */
export async function deleteQuote(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Só a equipe da Anuntech pode excluir." };
  const quoteId = z.string().uuid().safeParse(form.get("id"));
  if (!quoteId.success) return { error: "Orçamento não encontrado." };
  try {
    const deleted = await db.transaction(async (tx) => {
      // Locked so a send or an answer racing this delete either lands first (and is judged) or finds nothing.
      const [q] = await tx.select().from(quotes).where(eq(quotes.id, quoteId.data)).for("update");
      if (!q) throw new Refusal("Orçamento não encontrado.");
      const block = quoteDeletionBlock(q.status, { validUntil: q.validUntil, today: saoPauloDate() });
      if (block) throw new Refusal(block);
      const [company] = await tx.select({ name: companies.name }).from(companies).where(eq(companies.id, q.companyId));
      const [{ versions }] = await tx
        .select({ versions: count() })
        .from(quoteVersions)
        .where(eq(quoteVersions.quoteId, q.id));
      const number = quoteNumberLabel(q.year, q.seq);
      const answered = q.status === "accepted" || q.status === "declined";
      const decision = answered
        ? {
            status: q.status,
            decidedAt: q.decidedAt?.toISOString() ?? null,
            decidedParty: q.decidedParty,
            decidedName: q.decidedName,
            decidedEmail: q.decidedEmail,
            decidedIp: q.decidedIp,
            decisionNote: q.decisionNote,
            version: q.publishedVersion,
            documentHash: q.documentHash,
            totalCents: quoteTotals(q.publication ?? q.content).totalCents,
          }
        : null;
      await tx.delete(quoteVersions).where(eq(quoteVersions.quoteId, q.id));
      await tx.delete(quotes).where(eq(quotes.id, q.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: q.companyId,
        entityId: q.id,
        action: "quote.deleted",
        details: {
          number,
          // year + seq let new quotes skip this number (see nextQuoteSeq).
          year: q.year,
          seq: q.seq,
          title: q.title,
          company: company?.name ?? null,
          status: q.status,
          validUntil: q.validUntil,
          versions,
          decision,
        },
      });
      return { number };
    });
    // No revalidatePath on purpose: any revalidation makes Next re-render the page
    // the action came from inside the response, and the proposal's own page would
    // answer notFound() and unmount the dialog before it can navigate. Every page
    // that shows proposals is dynamic, so ServerForm's push (or refresh) is fresh.
    const success = `Orçamento nº ${deleted.number} excluído.`;
    return form.get("from") === "list" ? { success } : { success, href: "/orcamentos" };
  } catch (e) {
    if (!(e instanceof Refusal)) console.error("[delete] quote failed", e);
    return {
      error: e instanceof Refusal ? e.message : "Não foi possível excluir o orçamento. Tente novamente.",
    };
  }
}
