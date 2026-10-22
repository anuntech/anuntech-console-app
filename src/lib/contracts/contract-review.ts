import "server-only";
import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditEvents, companies, contractChangeRequests, contractSignatures, contracts } from "@/db/schema";
import { answersForClient, ASSISTED_DECISION, type Actor } from "../access/access";
import type { ActionState } from "../action-state";
import { DATABASE_FAILURE, logDatabaseFault } from "../action-errors";
import { db } from "../db";
import { sendOpsMail } from "../notifications/ops-alerts";
import { blockLabel, contractBlocks, requestable } from "./contract-text";

/*
 * Review rounds of a sent contract, the client's side. The client writes
 * change requests on clauses of the version in front of them (drafts,
 * visible only to their side), then sends the round: the contract goes to
 * in_review and the team accepts or declines each request while editing the
 * next version (decideChangeRequest). The web's actions and the app's
 * contracts.saveRequest/discardRequest/submitRequests call these.
 */

export const id = z.string().uuid();
export const blocked = { error: "Você não tem permissão para fazer isso." };
const MAX_DRAFTS = 50;
const comment = z
  .string()
  .trim()
  .min(1, "Explique o que precisa mudar.")
  .max(2000, "Use até 2 mil caracteres no pedido.");
const proposal = z.string().max(8000, "Use até 8 mil caracteres no texto proposto.").default("");

export const saveRequestInput = z.object({
  contractId: id,
  requestId: z.union([id, z.literal("")]).default(""),
  blockIndex: z.coerce.number().int().min(0),
  comment,
  proposedText: proposal,
});
export type SaveRequestInput = z.input<typeof saveRequestInput>;

export const reviewFailure = (e: unknown): ActionState =>
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

/** Who answers for the client: the company's managers, who also sign. Assisted access is refused by name. */
const clientSide = (actor: Actor, companyId: string) => {
  if (actor.assisting) throw Error(ASSISTED_DECISION);
  return answersForClient(actor, companyId);
};

export const refreshReview = (contractId: string) => {
  revalidatePath("/contratos");
  revalidatePath(`/contratos/${contractId}`);
  revalidatePath("/painel");
};

/** A request on one block of the version the client is reading; new, or an edit of one not sent yet. */
export async function saveChangeRequestAs(actor: Actor, raw: SaveRequestInput): Promise<ActionState> {
  try {
    const input = saveRequestInput.parse(raw);
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
    refreshReview(input.contractId);
    return { success: input.requestId ? "Pedido atualizado." : "Pedido salvo. Envie à Anuntech quando terminar." };
  } catch (e) {
    return reviewFailure(e);
  }
}

/** Drops a request the client has not sent yet. */
export async function deleteChangeRequestAs(actor: Actor, raw: { id: unknown }): Promise<ActionState> {
  try {
    const requestId = id.parse(raw.id);
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
    refreshReview(contractId);
    return { success: "Pedido descartado." };
  } catch (e) {
    return reviewFailure(e);
  }
}

/** Sends the round: the team gets the requests and the contract waits for a new version. */
export async function submitChangeRequestsAs(actor: Actor, raw: { contractId: unknown }): Promise<ActionState> {
  try {
    const contractId = id.parse(raw.contractId);
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
    refreshReview(contractId);
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
    return reviewFailure(e);
  }
}
