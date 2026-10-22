"use server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auditEvents, contractChangeRequests, contracts } from "@/db/schema";
import { getActor } from "../access/access";
import type { ActionState } from "../action-state";
import { db } from "../db";
import { applyProposal } from "./contract-text";
import {
  blocked,
  deleteChangeRequestAs,
  id,
  refreshReview as refresh,
  reviewFailure as failure,
  saveChangeRequestAs,
  submitChangeRequestsAs,
  type SaveRequestInput,
} from "./contract-review";

/*
 * Review rounds of a sent contract. The client writes change requests on
 * clauses of the version in front of them (drafts, visible only to their
 * side), then sends the round: the contract goes to in_review and the team
 * accepts or declines each request while editing the next version. Sending
 * that version (sendContract) needs every request answered. The client's
 * side lives in contract-review.ts, shared with the app's API.
 */

const response = z.string().trim().max(2000, "Use até 2 mil caracteres na resposta.").default("");

/** A request on one block of the version the client is reading; new, or an edit of one not sent yet. */
export async function saveChangeRequest(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  return saveChangeRequestAs(actor, Object.fromEntries(form) as SaveRequestInput);
}

/** Drops a request the client has not sent yet. */
export async function deleteChangeRequest(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  return deleteChangeRequestAs(actor, { id: form.get("id") });
}

/** Sends the round: the team gets the requests and the contract waits for a new version. */
export async function submitChangeRequests(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  return submitChangeRequestsAs(actor, { contractId: form.get("contractId") });
}

/**
 * The team's answer to one request. Accepting a proposed text puts it into
 * the draft when the clause still reads as the client saw it; otherwise the
 * team applies it by hand. Declining needs a reason the client will read.
 * A decision can change until the next version goes out, except that a text
 * already applied stays in the draft (edit it there).
 */
export async function decideChangeRequest(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor.admin) return blocked;
  try {
    const input = z
      .object({ id, decision: z.enum(["accept", "decline"]), response })
      .parse(Object.fromEntries(form));
    if (input.decision === "decline" && !input.response)
      throw Error("Diga ao cliente por que este pedido não foi aceito.");
    const outcome = await db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(contractChangeRequests)
        .where(eq(contractChangeRequests.id, input.id))
        .for("update");
      if (!request) throw Error("Pedido não encontrado.");
      const [c] = await tx.select().from(contracts).where(eq(contracts.id, request.contractId)).for("update");
      if (!c || c.status !== "in_review" || request.version !== c.publishedVersion)
        throw Error("Este pedido é de uma versão que já foi respondida.");
      if (request.status === "draft") throw Error("O cliente ainda não enviou este pedido.");
      if (request.applied)
        throw Error("O texto proposto já está no rascunho; para mudar, edite o texto do contrato.");
      let applied = false;
      if (input.decision === "accept" && request.proposedText) {
        const body = applyProposal(c.body, request.excerpt, request.proposedText);
        if (body !== null) {
          await tx
            .update(contracts)
            .set({ body, revision: c.revision + 1, updatedAt: new Date() })
            .where(eq(contracts.id, c.id));
          applied = true;
        }
      }
      await tx
        .update(contractChangeRequests)
        .set({
          status: input.decision === "accept" ? "accepted" : "declined",
          applied,
          response: input.response || null,
          decidedBy: actor.user.id,
          decidedAt: new Date(),
        })
        .where(eq(contractChangeRequests.id, request.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: c.companyId,
        entityId: c.id,
        action: input.decision === "accept" ? "contract.change_accepted" : "contract.change_declined",
        details: { request: request.id, label: request.label, version: request.version, applied },
      });
      return { contractId: c.id, applied, proposed: !!request.proposedText };
    });
    refresh(outcome.contractId);
    return {
      success:
        input.decision === "decline"
          ? "Recusado. O cliente lê a resposta com a nova versão."
          : outcome.applied
            ? "Aceito. O texto proposto entrou no rascunho."
            : outcome.proposed
              ? "Aceito. A cláusula já mudou no rascunho; aplique o texto proposto à mão."
              : "Aceito. Ajuste o texto do rascunho como o cliente pediu.",
    };
  } catch (e) {
    return failure(e);
  }
}
