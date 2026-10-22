import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "../db";
import { canAccess, ASSISTED_DECISION, type Actor } from "../access/access";
import { partyFor, type DecisionEvidence } from "../access/client-decision";
import { auditEvents, companies, contractChangeRequests, contractSignatures, contracts } from "@/db/schema";
import { contractPdf } from "./contract-pdf";
import { contractHashMatches } from "./contract-hash";
import { contractFailure, refreshContracts } from "./contract-common";
import { sendOpsMail } from "../notifications/ops-alerts";
import { deliverContractSigned } from "../automations/client-automations";
import { longDateLabel } from "../format";

export type SignResult = { error: string } | { success: string; signed: boolean };

/**
 * Records the viewer's signature with the evidence behind it: the web's
 * signContract and the app's contracts.sign. When both parties have signed
 * the current version, the contract closes and the final PDF is stored. A
 * signed amendment that carries new dates moves the original contract's
 * validity, so the alerts follow the amendment.
 */
export async function signContractAs(
  actor: Actor,
  input: { id: string; consent: boolean },
  evidence: DecisionEvidence,
): Promise<SignResult> {
  try {
    if (!input.consent) return { error: "Marque que leu e concorda com o contrato para assinar." };
    const [c] = await db.select().from(contracts).where(eq(contracts.id, input.id));
    if (!c || !canAccess(actor, c.companyId, "finance")) return { error: "Você não tem permissão para fazer isso." };
    if (actor.assisting) return { error: ASSISTED_DECISION };
    const party = partyFor(actor, c.companyId);
    if (!party) return { error: "Só um Administrador da empresa pode assinar." };
    if (c.status !== "sent" || !c.publication || !c.documentHash)
      return { error: "Este contrato não está aguardando assinatura." };
    if (!contractHashMatches(c.publication, c.documentHash))
      return { error: "O texto do contrato não confere com o registro. Peça um novo envio." };
    const { ip } = evidence;
    const closed = await db.transaction(async (tx) => {
      // Signing, going back to draft and a review round all lock the contract: two signatures at once
      // see each other (so the second one closes it), and the version checked above is still the one sent.
      const [locked] = await tx
        .select({ status: contracts.status, documentHash: contracts.documentHash })
        .from(contracts)
        .where(eq(contracts.id, c.id))
        .for("update");
      if (locked?.status !== "sent" || locked.documentHash !== c.documentHash) throw Error("stale");
      const current = and(eq(contractSignatures.contractId, c.id), eq(contractSignatures.documentHash, c.documentHash!));
      const [existing] = await tx
        .select({ id: contractSignatures.id })
        .from(contractSignatures)
        .where(and(current, eq(contractSignatures.party, party)));
      if (existing) throw Error("Esta parte já assinou esta versão do contrato.");
      await tx.insert(contractSignatures).values({
        contractId: c.id,
        party,
        userId: actor.user.id,
        // A person who never set a name still signs identifiably, by the e-mail they logged in with.
        name: actor.user.name || actor.user.email,
        email: actor.user.email,
        documentHash: c.documentHash!,
        ip,
        userAgent: evidence.userAgent,
        method: "otp_session",
        sessionStartedAt: evidence.sessionStartedAt,
      });
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: c.companyId,
        entityId: c.id,
        action: "contract.signed",
        details: { party, ip, version: c.publishedVersion },
      });
      // Signing settles it: change requests the client wrote but never sent go away.
      if (party === "client")
        await tx
          .delete(contractChangeRequests)
          .where(and(eq(contractChangeRequests.contractId, c.id), eq(contractChangeRequests.status, "draft")));
      const signatures = await tx
        .select()
        .from(contractSignatures)
        .where(current)
        .orderBy(asc(contractSignatures.signedAt));
      const complete = ["client", "anuntech"].every((p) => signatures.some((s) => s.party === p));
      if (!complete) return false;
      const pdf = await contractPdf({
        ...c.publication!,
        id: c.id,
        status: "signed",
        date: new Date(),
        hash: c.documentHash!,
        signatures: signatures.map((s) => ({
          party: s.party,
          name: s.name,
          email: s.email,
          signedAt: s.signedAt,
          ip: s.ip,
          method: s.method,
        })),
      });
      await tx
        .update(contracts)
        .set({ status: "signed", signedAt: new Date(), signedPdf: pdf, updatedAt: new Date() })
        .where(eq(contracts.id, c.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: c.companyId,
        entityId: c.id,
        action: "contract.completed",
      });
      if (c.kind === "amendment" && c.parentId && (c.startsAt || c.endsAt)) {
        await tx
          .update(contracts)
          .set({
            ...(c.startsAt ? { startsAt: c.startsAt } : {}),
            ...(c.endsAt ? { endsAt: c.endsAt, expiryNoticeSentAt: null, expiredNoticeSentAt: null } : {}),
            updatedAt: new Date(),
          })
          .where(eq(contracts.id, c.parentId));
        await tx.insert(auditEvents).values({
          actorId: actor.user.id,
          companyId: c.companyId,
          entityId: c.parentId,
          action: "contract.term_amended",
          details: { amendmentId: c.id, startsAt: c.startsAt, endsAt: c.endsAt },
        });
      }
      return true;
    });
    refreshContracts(c.id, c.parentId);
    const noun = c.kind === "amendment" ? "Aditivo" : "Contrato";
    // Both sides signed: the client gets the final PDF's link and the next steps (Configurações → Automações).
    if (closed) after(() => deliverContractSigned(c.id).catch(() => undefined));
    // The client signed first: the team hears it now, so the contract closes the same day.
    if (!closed && party === "client") {
      const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, c.companyId));
      await sendOpsMail(
        `[Console] ${noun} assinado pelo cliente: falta a Anuntech · ${company?.name ?? ""}`,
        `${actor.user.name || actor.user.email} assinou "${c.title}" por ${company?.name ?? "o cliente"} em ${longDateLabel(new Date())}.\n\nFalta a assinatura da Anuntech. Assine pelo Console: ${process.env.BETTER_AUTH_URL || "http://localhost:3100"}/contratos/${c.id}\n\nConsole da Anuntech`,
      );
    }
    return {
      signed: closed,
      success: closed
        ? `${noun} assinado pelas duas partes. O PDF final já está disponível.`
        : party === "client"
          ? "Sua assinatura foi registrada. Falta a assinatura da Anuntech."
          : "Sua assinatura foi registrada. Falta a assinatura do cliente.",
    };
  } catch (e) {
    const failed = contractFailure(e);
    return { error: failed.error ?? "Não foi possível salvar o contrato. Confira os dados e tente novamente." };
  }
}
