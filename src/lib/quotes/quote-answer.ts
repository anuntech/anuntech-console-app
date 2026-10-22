import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { canAccess, ASSISTED_DECISION, type Actor } from "../access/access";
import { partyFor, type DecisionEvidence } from "../access/client-decision";
import { auditEvents, companies, quotes } from "@/db/schema";
import type { ActionState } from "../action-state";
import { saoPauloDate } from "../dates";
import { currency, longDateLabel } from "../format";
import { sendOpsMail } from "../notifications/ops-alerts";
import { billingProblemsLabel, billingReadiness } from "../billing/billing-readiness";
import { documentHash } from "../document-hash";
import { quoteExpired, quoteTotals } from "./quote-model";
import { consoleUrl, quoteFailure, refreshQuotes } from "./quote-common";

/** The note that goes with an answer: optional, up to a thousand characters. */
export const quoteNoteField = z.string().trim().max(1000, "A observação pode ter até mil caracteres.").default("");

export type QuoteAnswer = { id: string; decision: "accept" | "decline"; note: string; consent: boolean };

/**
 * Records the client's answer with the evidence behind it: the web's
 * answerQuote and the app's quotes.answer. A manager of the company answers
 * for the client; Anuntech can record an answer received outside the
 * Console, and the record says so. Nothing else happens here: contract,
 * products and billing are created by hand from the accepted proposal.
 */
export async function answerQuoteAs(actor: Actor, input: QuoteAnswer, evidence: DecisionEvidence): Promise<ActionState> {
  try {
    const note = quoteNoteField.parse(input.note);
    const [q] = await db.select().from(quotes).where(eq(quotes.id, input.id));
    if (!q || !canAccess(actor, q.companyId, "finance")) return { error: "Você não tem permissão para fazer isso." };
    if (actor.assisting) return { error: ASSISTED_DECISION };
    const party = partyFor(actor, q.companyId);
    if (!party) return { error: "Só um Administrador da empresa pode responder ao orçamento." };
    if (q.status !== "sent" || !q.publication || !q.documentHash) return { error: "Este orçamento não está aguardando resposta." };
    if (quoteExpired(q.status, q.validUntil, saoPauloDate()))
      return {
        error:
          party === "client"
            ? "Este orçamento expirou. Peça à Anuntech uma nova versão com validade atualizada."
            : "O orçamento expirou. Volte para rascunho, ajuste a validade e envie de novo.",
      };
    if (documentHash(q.publication) !== q.documentHash) return { error: "O conteúdo não confere com o registro. Peça um novo envio." };
    if (input.decision === "accept" && party === "client" && !input.consent)
      return { error: "Marque que leu e concorda com a proposta para aceitar." };
    const { ip } = evidence;
    // The session that answered is the client's proof of identity; the team records answers given elsewhere.
    const sessionStartedAt = party === "client" ? evidence.sessionStartedAt : null;
    const status = input.decision === "accept" ? "accepted" : "declined";
    await db.transaction(async (tx) => {
      const [current] = await tx.select({ status: quotes.status }).from(quotes).where(eq(quotes.id, q.id)).for("update");
      if (current?.status !== "sent") throw Error("Este orçamento já foi respondido.");
      await tx
        .update(quotes)
        .set({
          status,
          decidedAt: new Date(),
          decidedBy: actor.user.id,
          decidedParty: party,
          decidedName: actor.user.name || actor.user.email,
          decidedEmail: actor.user.email,
          decidedIp: party === "client" ? ip : null,
          decisionNote: note || null,
          revision: q.revision + 1,
          updatedAt: new Date(),
        })
        .where(eq(quotes.id, q.id));
      await tx.insert(auditEvents).values({
        actorId: actor.user.id,
        companyId: q.companyId,
        entityId: q.id,
        action: `quote.${status}`,
        details: { party, ip, version: q.publishedVersion, sessionStartedAt },
      });
    });
    const totals = quoteTotals(q.publication);
    // The down payment cannot go out without a full billing address: the team hears it now, not on the day.
    const [payer] = status === "accepted" ? await db.select().from(companies).where(eq(companies.id, q.companyId)) : [];
    const problems = payer ? billingReadiness(payer) : [];
    const billingNote = problems.length
      ? `\n\nAtenção: ${billingProblemsLabel(problems)} no cadastro. Sem isso, a entrada e as cobranças deste cliente não saem no Inter. Corrija em ${consoleUrl()}/empresas/${q.companyId}?editar=1`
      : "";
    const who = party === "client" ? `${actor.user.name || actor.user.email} (${q.publication.companyName})` : `${actor.user.name || actor.user.email}, pela Anuntech, a pedido do cliente`;
    await sendOpsMail(
      `Orçamento ${q.publication.number} ${status === "accepted" ? "aceito" : "recusado"}: ${q.title}`,
      `${status === "accepted" ? "Aceito" : "Recusado"} por ${who} em ${longDateLabel(new Date())}.\n\nCliente: ${q.publication.companyName}\nValor: ${currency(totals.totalCents)}${note ? `\nObservação: ${note}` : ""}\n\n${status === "accepted" ? "Os próximos passos estão no orçamento, já preenchidos: contrato, projeto com o quadro das fases e as cobranças de entrada e saldo. Cada um nasce como rascunho para você conferir." : ""}${billingNote}\n\nAbrir no Console: ${consoleUrl()}/orcamentos/${q.id}`,
    );
    refreshQuotes(q.id);
    return {
      success:
        status === "accepted"
          ? party === "client"
            ? "Orçamento aceito. A Anuntech já foi avisada e entra em contato para os próximos passos."
            : "Aceite registrado."
          : party === "client"
            ? "Resposta registrada. Obrigado por avisar."
            : "Recusa registrada.",
    };
  } catch (e) {
    return quoteFailure(e);
  }
}
