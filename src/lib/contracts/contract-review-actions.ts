"use server";
import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditEvents, companies, contractChangeRequests, contractSignatures, contracts } from "@/db/schema";
import { getActor, type Actor } from "../access/access";
import { hasPermission } from "../access/permissions";
import type { ActionState } from "../action-state";
import { DATABASE_FAILURE, logDatabaseFault } from "../action-errors";
import { db } from "../db";
import { sendOpsMail } from "../notifications/ops-alerts";
import { applyProposal, blockLabel, contractBlocks, requestable } from "./contract-text";

/*
 * Review rounds of a sent contract. The client writes change requests on
 * clauses of the version in front of them (drafts, visible only to their
 * side), then sends the round: the contract goes to in_review and the team
 * accepts or declines each request while editing the next version. Sending
 * that version (sendContract) needs every request answered.
 */

const id = z.string().uuid();
const blocked = { error: "Você não tem permissão para fazer isso." };
const MAX_DRAFTS = 50;
const comment = z
  .string()
  .trim()
  .min(1, "Explique o que precisa mudar.")
  .max(2000, "Use até 2 mil caracteres no pedido.");
const proposal = z.string().max(8000, "Use até 8 mil caracteres no texto proposto.").default("");
const response = z.string().trim().max(2000, "Use até 2 mil caracteres na resposta.").default("");

const failure = (e: unknown): ActionState =>
  logDatabaseFault("contract review", e)
    ? { error: DATABASE_FAILURE }
    : {
        error:
          e instanceof z.ZodError
            ? e.issues[0].message
            : e instanceof Error && e.message
              ? e.message
              : "Não foi possível salvar. Tente novamente.",
      };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** After the company signs the version in front of it, changes come by ticket and amendment, not by a review round. */
async function refuseAfterClientSigned(tx: Tx, c: { id: string; documentHash: string | null }) {
  if (!c.documentHash) return;
  const [signed] = await tx
    .select({ id: contractSignatures.id })
    .from(contractSignatures)
    .where(
      and(
        eq(contractSignatures.contractId, c.id),
        eq(contractSignatures.documentHash, c.documentHash),
        eq(contractSignatures.party, "client"),
      ),
    );
  if (signed) throw Error("A sua empresa já assinou esta versão. Se algo precisa mudar, abra um chamado.");
}

/** Who answers for the client: the company's managers, who also sign. */
const clientSide = (actor: Actor, companyId: string) => {
  if (actor.admin) return false;
  const grant = actor.grants.find((g) => g.company.id === companyId);
  return !!grant && hasPermission(grant.role, "finance");
};

const refresh = (contractId: string) => {
  revalidatePath("/contratos");
  revalidatePath(`/contratos/${contractId}`);
  revalidatePath("/painel");
};

/** A request on one block of the version the client is reading; new, or an edit of one not sent yet. */
export async function saveChangeRequest(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  try {
    const input = z
      .object({
        contractId: id,
        requestId: z.union([id, z.literal("")]).default(""),
        blockIndex: z.coerce.number().int().min(0),
        comment,
        proposedText: proposal,
      })
      .parse(Object.fromEntries(form));
    await db.transaction(async (tx) => {
      const [c] = await tx.select().from(contracts).where(eq(contracts.id, input.contractId)).for("update");
      if (!c || !clientSide(actor, c.companyId)) throw Error(blocked.error);
      if (c.status !== "sent" || !c.publication)
        throw Error("Este contrato não está aguardando assinatura; não há o que revisar agora.");
      await refuseAfterClientSigned(tx, c);
      const block = contractBlocks(c.publication.body)[input.blockIndex];
      if (!block || !requestable(block)) throw Error("Escolha uma cláusula do texto.");
      const proposed = input.proposedText.replace(/\r\n?/g, "\n").trim();
      const values = {
        comment: input.comment,
        // The same text again is no proposal at all.
        proposedText: proposed && proposed !== block.text ? proposed : null,
      };
      if (input.requestId) {
        const [updated] = await tx
          .update(contractChangeRequests)
          .set(values)
          .where(
            and(
              eq(contractChangeRequests.id, input.requestId),
              eq(contractChangeRequests.contractId, c.id),
              eq(contractChangeRequests.version, c.publishedVersion),
              eq(contractChangeRequests.status, "draft"),
            ),
          )
          .returning({ id: contractChangeRequests.id });
        if (!updated) throw Error("Este pedido já foi enviado e não pode mais ser editado.");
        return;
      }
      const [{ drafts }] = await tx
        .select({ drafts: count() })
        .from(contractChangeRequests)
        .where(and(eq(contractChangeRequests.contractId, c.id), eq(contractChangeRequests.status, "draft")));
      if (drafts >= MAX_DRAFTS) throw Error(`Envie os pedidos que já escreveu; uma rodada aceita até ${MAX_DRAFTS}.`);
      await tx.insert(contractChangeRequests).values({
        ...values,
        contractId: c.id,
        version: c.publishedVersion,
        blockIndex: input.blockIndex,
        label: blockLabel(block),
        excerpt: block.text,
        authorId: actor.user.id,
      });
    });
    refresh(input.contractId);
    return { success: input.requestId ? "Pedido atualizado." : "Pedido salvo. Envie à Anuntech quando terminar." };
  } catch (e) {
    return failure(e);
  }
}

/** Drops a request the client has not sent yet. */
export async function deleteChangeRequest(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  try {
    const requestId = id.parse(form.get("id"));
    const contractId = await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ request: contractChangeRequests, companyId: contracts.companyId })
        .from(contractChangeRequests)
        .innerJoin(contracts, eq(contracts.id, contractChangeRequests.contractId))
        .where(eq(contractChangeRequests.id, requestId));
      if (!row || !clientSide(actor, row.companyId)) throw Error(blocked.error);
      if (row.request.status !== "draft") throw Error("Este pedido já foi enviado e fica no histórico.");
      await tx.delete(contractChangeRequests).where(eq(contractChangeRequests.id, requestId));
      return row.request.contractId;
    });
    refresh(contractId);
    return { success: "Pedido descartado." };
  } catch (e) {
    return failure(e);
  }
}

/** Sends the round: the team gets the requests and the contract waits for a new version. */
export async function submitChangeRequests(_: ActionState, form: FormData): Promise<ActionState> {
  const actor = await getActor();
  try {
    const contractId = id.parse(form.get("contractId"));
    const sent = await db.transaction(async (tx) => {
      const [c] = await tx.select().from(contracts).where(eq(contracts.id, contractId)).for("update");
      if (!c || !clientSide(actor, c.companyId)) throw Error(blocked.error);
      if (c.status !== "sent") throw Error("Este contrato não está aguardando assinatura; não há o que revisar agora.");
      await refuseAfterClientSigned(tx, c);
      const requests = await tx
        .update(contractChangeRequests)
        .set({ status: "pending", submittedAt: new Date() })
        .where(
          and(
            eq(contractChangeRequests.contractId, c.id),
            eq(contractChangeRequests.version, c.publishedVersion),
            eq(contractChangeRequests.status, "draft"),
          ),
        )
        .returning();
      if (!requests.length) throw Error("Escreva ao menos um pedido de alteração antes de enviar.");
      await tx
        .update(contracts)
        .set({ status: "in_review", revision: c.revision + 1, updatedAt: new Date() })
        .where(eq(contracts.id, c.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: c.companyId,
        entityId: c.id,
        action: "contract.changes_requested",
        details: { version: c.publishedVersion, requests: requests.length },
      });
      const [company] = await tx.select({ name: companies.name }).from(companies).where(eq(companies.id, c.companyId));
      return { contract: c, company: company?.name ?? "", requests };
    });
    refresh(contractId);
    const { contract: c, requests } = sent;
    const noun = c.kind === "amendment" ? "aditivo" : "contrato";
    const list = requests
      .sort((a, b) => a.blockIndex - b.blockIndex)
      .map((r) => `${r.label}: ${r.comment}${r.proposedText ? `\nTexto proposto: ${r.proposedText}` : ""}`)
      .join("\n\n");
    await sendOpsMail(
      `Pedido de alteração: ${c.title}`,
      `${sent.company} pediu ${requests.length === 1 ? "uma alteração" : `${requests.length} alterações`} no ${noun} "${c.title}" (versão ${c.publishedVersion}).\n\n${list}\n\nResponda cada pedido e envie a nova versão pelo Console: ${process.env.BETTER_AUTH_URL || "http://localhost:3100"}/contratos/${c.id}\n\nConsole da Anuntech`,
    );
    return {
      success:
        requests.length === 1
          ? "Pedido enviado. A Anuntech revisa e manda uma nova versão."
          : `${requests.length} pedidos enviados. A Anuntech revisa e manda uma nova versão.`,
    };
  } catch (e) {
    return failure(e);
  }
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
