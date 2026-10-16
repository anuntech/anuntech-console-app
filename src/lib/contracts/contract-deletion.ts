"use server";
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import {
  auditEvents,
  companies,
  contractChangeRequests,
  contractSignatures,
  contractVersions,
  contracts,
  serviceTerms,
} from "@/db/schema";
import { getActor } from "../access/access";
import type { ActionState } from "../action-state";
import { db } from "../db";
import { contractDeletionBlock } from "../deletion-rules";
import { logDatabaseFault } from "../action-errors";

/** A refusal whose message is safe to show; anything else gets the generic one. */
class Refusal extends Error {}

/**
 * Deletes a draft or cancelled contract (or amendment) for good, with its
 * sent versions. Never one with a signature on any version or with
 * amendments pointing at it: those stay as the record. The signed PDF
 * lives in the row itself, so there is no stored file to remove. Staff
 * only; the audit event keeps the title and company. From the contract's
 * page the person goes back to the list (an amendment, to its contract);
 * with `from=list` the list refreshes in place, keeping filters and page.
 */
export async function deleteContract(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return { error: "Só a equipe da Anuntech pode excluir." };
  const contractId = z.string().uuid().safeParse(form.get("id"));
  if (!contractId.success) return { error: "Contrato não encontrado." };
  try {
    const deleted = await db.transaction(async (tx) => {
      // Locked so a send or signature racing this delete either lands first (and blocks it) or finds nothing.
      const [c] = await tx.select().from(contracts).where(eq(contracts.id, contractId.data)).for("update");
      if (!c) throw new Refusal("Contrato não encontrado.");
      const [{ signatures }] = await tx
        .select({ signatures: count() })
        .from(contractSignatures)
        .where(eq(contractSignatures.contractId, c.id));
      const [{ amendments }] = await tx
        .select({ amendments: count() })
        .from(contracts)
        .where(eq(contracts.parentId, c.id));
      const block = contractDeletionBlock({ status: c.status, signatures, amendments, kind: c.kind });
      if (block) throw new Refusal(block);
      const [company] = await tx.select({ name: companies.name }).from(companies).where(eq(companies.id, c.companyId));
      const [{ versions }] = await tx
        .select({ versions: count() })
        .from(contractVersions)
        .where(eq(contractVersions.contractId, c.id));
      await tx.update(serviceTerms).set({ contractId: null }).where(eq(serviceTerms.contractId, c.id));
      await tx.delete(contractChangeRequests).where(eq(contractChangeRequests.contractId, c.id));
      await tx.delete(contractVersions).where(eq(contractVersions.contractId, c.id));
      await tx.delete(contracts).where(eq(contracts.id, c.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: c.companyId,
        entityId: c.id,
        action: "contract.deleted",
        details: {
          title: c.title,
          kind: c.kind,
          company: company?.name ?? null,
          status: c.status,
          parentId: c.parentId,
          versions,
        },
      });
      return { kind: c.kind, parentId: c.parentId };
    });
    // No revalidatePath on purpose: any revalidation makes Next re-render the page
    // the action came from inside the response, and the contract's own page would
    // answer notFound() and unmount the dialog before it can navigate. Every page
    // that shows contracts is dynamic, so ServerForm's push (or refresh) is fresh.
    const success = deleted.kind === "amendment" ? "Aditivo excluído." : "Contrato excluído.";
    // An amendment's page sits under its contract, so that is where the person goes back to.
    const href = deleted.parentId ? `/contratos/${deleted.parentId}` : "/contratos";
    return form.get("from") === "list" ? { success } : { success, href };
  } catch (e) {
    // A query's error prints its values; the database's own code and index are enough.
    if (!(e instanceof Refusal) && !logDatabaseFault("delete contract", e)) console.error("[delete] contract failed", e);
    return {
      error: e instanceof Refusal ? e.message : "Não foi possível excluir o contrato. Tente novamente.",
    };
  }
}
